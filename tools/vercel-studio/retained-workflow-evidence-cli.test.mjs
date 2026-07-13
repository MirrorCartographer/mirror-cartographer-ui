import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRetainedWorkflowEvidence, main } from './retained-workflow-evidence-cli.mjs';

const commitSha = 'a'.repeat(40);
const run = {
  id: 17,
  head_sha: commitSha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 23,
  run_attempt: 1
};

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'vercel-evidence-'));
  const paths = {
    primary: join(directory, 'primary.json'),
    ghPages: join(directory, 'gh-pages.json'),
    ghCommand: join(directory, 'gh-command.txt'),
    output: join(directory, 'bundle.json')
  };
  await Promise.all([
    writeFile(paths.primary, JSON.stringify({
      complete: true,
      reason: 'exhausted_pagination',
      commitSha,
      pagesFetched: 1,
      runs: [run]
    })),
    writeFile(paths.ghPages, JSON.stringify([{ total_count: 1, workflow_runs: [run] }])),
    writeFile(paths.ghCommand, `gh api repos/o/r/actions/runs -f head_sha=${commitSha} --paginate --slurp\n`)
  ]);
  return paths;
}

function validArgs(paths) {
  return [
    '--commit', commitSha,
    '--primary', paths.primary,
    '--gh-pages', paths.ghPages,
    '--gh-command', paths.ghCommand,
    '--primary-retrieved-at', '2026-07-13T00:00:00Z',
    '--gh-retrieved-at', '2026-07-13T00:01:00Z',
    '--generated-at', '2026-07-13T00:02:00Z',
    '--output', paths.output
  ];
}

test('builds a verified retained bundle from matching exhaustive outputs', async () => {
  const paths = await fixture();
  const bundle = await buildRetainedWorkflowEvidence({
    commitSha,
    primaryPath: paths.primary,
    ghPagesPath: paths.ghPages,
    ghCommandPath: paths.ghCommand,
    primaryRetrievedAt: '2026-07-13T00:00:00Z',
    ghRetrievedAt: '2026-07-13T00:01:00Z',
    generatedAt: '2026-07-13T00:02:00Z'
  });
  assert.equal(bundle.verified, true);
  assert.equal(bundle.reconciliation.reason, 'independent_enumerations_match');
  assert.equal(bundle.independent_envelope.command_contract.paginate, true);
  assert.equal(bundle.independent_envelope.command_contract.slurp, true);
});

test('fails closed when the retained gh command is not exhaustive', async () => {
  const paths = await fixture();
  await writeFile(paths.ghCommand, `gh api repos/o/r/actions/runs -f head_sha=${commitSha}\n`);
  const bundle = await buildRetainedWorkflowEvidence({
    commitSha,
    primaryPath: paths.primary,
    ghPagesPath: paths.ghPages,
    ghCommandPath: paths.ghCommand,
    primaryRetrievedAt: '2026-07-13T00:00:00Z',
    ghRetrievedAt: '2026-07-13T00:01:00Z',
    generatedAt: '2026-07-13T00:02:00Z'
  });
  assert.equal(bundle.verified, false);
  assert.equal(bundle.reconciliation.reason, 'independent_non_exhaustive_command_contract');
});

test('CLI writes once and refuses to overwrite retained evidence', async () => {
  const paths = await fixture();
  const args = validArgs(paths);
  await main(args);
  const written = JSON.parse(await readFile(paths.output, 'utf8'));
  assert.equal(written.verified, true);
  await assert.rejects(() => main(args), /EEXIST/);
});

test('CLI rejects duplicate flags instead of silently taking the last value', async () => {
  const paths = await fixture();
  const args = validArgs(paths);
  args.push('--commit', 'b'.repeat(40));
  await assert.rejects(() => main(args), /duplicate_argument:commit/);
});

test('rejects malformed and impossible source timestamps', async () => {
  const paths = await fixture();
  const base = {
    commitSha,
    primaryPath: paths.primary,
    ghPagesPath: paths.ghPages,
    ghCommandPath: paths.ghCommand,
    ghRetrievedAt: '2026-07-13T00:01:00Z',
    generatedAt: '2026-07-13T00:02:00Z'
  };
  await assert.rejects(
    () => buildRetainedWorkflowEvidence({ ...base, primaryRetrievedAt: 'yesterday' }),
    /primary_retrieved_at_timestamp_invalid/
  );
  await assert.rejects(
    () => buildRetainedWorkflowEvidence({ ...base, primaryRetrievedAt: '2026-02-30T00:00:00Z' }),
    /primary_retrieved_at_timestamp_invalid/
  );
});

test('rejects a bundle generation time that precedes either retained source', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence({
      commitSha,
      primaryPath: paths.primary,
      ghPagesPath: paths.ghPages,
      ghCommandPath: paths.ghCommand,
      primaryRetrievedAt: '2026-07-13T00:00:00Z',
      ghRetrievedAt: '2026-07-13T00:03:00Z',
      generatedAt: '2026-07-13T00:02:00Z'
    }),
    /generated_at_precedes_source_retrieval/
  );
});

test('rejects retained source aliases that resolve to the same file', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence({
      commitSha,
      primaryPath: paths.primary,
      ghPagesPath: paths.primary,
      ghCommandPath: paths.ghCommand,
      primaryRetrievedAt: '2026-07-13T00:00:00Z',
      ghRetrievedAt: '2026-07-13T00:01:00Z',
      generatedAt: '2026-07-13T00:02:00Z'
    }),
    /retained_source_paths_not_distinct/
  );
});

test('rejects symbolic links as retained evidence sources', async () => {
  const paths = await fixture();
  const linkedPrimary = `${paths.primary}.link`;
  await symlink(paths.primary, linkedPrimary);
  await assert.rejects(
    () => buildRetainedWorkflowEvidence({
      commitSha,
      primaryPath: linkedPrimary,
      ghPagesPath: paths.ghPages,
      ghCommandPath: paths.ghCommand,
      primaryRetrievedAt: '2026-07-13T00:00:00Z',
      ghRetrievedAt: '2026-07-13T00:01:00Z',
      generatedAt: '2026-07-13T00:02:00Z'
    }),
    /primary_symlink_rejected/
  );
});
