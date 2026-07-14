import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPromotionCli } from './workflow-enumeration-promotion-cli.mjs';

const sha = 'a'.repeat(40);
const run = {
  id: 1,
  head_sha: sha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 2,
  run_attempt: 1,
  updated_at: '2026-07-14T12:00:00Z'
};

function observation(started_at, completed_at) {
  return {
    started_at,
    completed_at,
    primary: { complete: true, commitSha: sha, runs: [run] },
    independent: { complete: true, commitSha: sha, runs: [structuredClone(run)] }
  };
}

function input() {
  return {
    schema_version: 1,
    commit_sha: sha,
    minimum_quiet_period_ms: 60000,
    observations: [
      observation('2026-07-14T12:01:00Z', '2026-07-14T12:02:00Z'),
      observation('2026-07-14T12:03:00Z', '2026-07-14T12:04:00Z')
    ]
  };
}

test('writes a new retained promotion artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'promotion-cli-'));
  const inputPath = join(directory, 'input.json');
  const outputPath = join(directory, 'output.json');
  await writeFile(inputPath, JSON.stringify(input()));
  const artifact = await runPromotionCli(['--input', inputPath, '--output', outputPath]);
  const retained = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(artifact.assessment.promotable, true);
  assert.equal(retained.artifact_type, 'workflow_enumeration_promotion_assessment');
  assert.equal(retained.assessment.reason, 'reconciled_observations_temporally_stable');
});

test('refuses to overwrite an existing output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'promotion-cli-'));
  const inputPath = join(directory, 'input.json');
  const outputPath = join(directory, 'output.json');
  await writeFile(inputPath, JSON.stringify(input()));
  await writeFile(outputPath, 'existing');
  await assert.rejects(
    runPromotionCli(['--input', inputPath, '--output', outputPath]),
    (error) => error?.code === 'EEXIST'
  );
  assert.equal(await readFile(outputPath, 'utf8'), 'existing');
});

test('rejects input and output path collision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'promotion-cli-'));
  const inputPath = join(directory, 'input.json');
  await writeFile(inputPath, JSON.stringify(input()));
  await assert.rejects(
    runPromotionCli(['--input', inputPath, '--output', inputPath]),
    /input_output_path_collision/
  );
});
