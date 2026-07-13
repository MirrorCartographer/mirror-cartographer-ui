import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRetainedPageChain } from './verify-vercel-retained-page-chain.mjs';

const sha = 'a'.repeat(40);
const repo = 'MirrorCartographer/mirror-cartographer-ui';
const url = (page) => `https://api.github.com/repos/${repo}/actions/runs?per_page=100&page=${page}&head_sha=${sha}`;

async function run() {
  const dir = await mkdtemp(join(tmpdir(), 'mc-page-chain-'));
  const input = join(dir, 'input.json');
  const output = join(dir, 'receipt.json');
  const valid = {
    repository: repo,
    commit_sha: sha,
    per_page: 100,
    pages: [
      { page: 1, workflow_runs: [{ id: 1, head_sha: sha }], next_url: url(2) },
      { page: 2, workflow_runs: [{ id: 2, head_sha: sha }], next_url: null }
    ]
  };

  await writeFile(input, JSON.stringify(valid));
  let result = await verifyRetainedPageChain({ input_path: input, output_path: output });
  assert.equal(result.verified, true);
  const receipt = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(receipt.validation.run_count, 2);
  assert.match(receipt.input.sha256, /^[0-9a-f]{64}$/);

  result = await verifyRetainedPageChain({ input_path: input, output_path: output });
  assert.equal(result.reason, 'output_exists');

  const badInput = join(dir, 'bad.json');
  const badOut = join(dir, 'bad-receipt.json');
  await writeFile(badInput, JSON.stringify({ ...valid, pages: [{ ...valid.pages[0], next_url: url(3) }, valid.pages[1]] }));
  result = await verifyRetainedPageChain({ input_path: badInput, output_path: badOut });
  assert.equal(result.verified, false);
  assert.equal(result.receipt.validation.reason, 'invalid_continuation_url');

  const cross = join(dir, 'cross.json');
  const crossOut = join(dir, 'cross-receipt.json');
  await writeFile(cross, JSON.stringify({ ...valid, pages: [{ page: 1, workflow_runs: [{ id: 1, head_sha: 'b'.repeat(40) }], next_url: null }] }));
  result = await verifyRetainedPageChain({ input_path: cross, output_path: crossOut });
  assert.equal(result.receipt.validation.reason, 'cross_commit_record');

  console.log('6 assertions passed');
}

run();
