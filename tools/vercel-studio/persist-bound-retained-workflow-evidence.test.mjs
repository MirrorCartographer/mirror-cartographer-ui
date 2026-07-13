import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBoundRetainedEvidence, main } from './persist-bound-retained-workflow-evidence.mjs';

const commitSha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const run = { id: 17, head_sha: commitSha, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 23, run_attempt: 1 };

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'bound-vercel-evidence-'));
  const paths = {
    approvedPlan: join(directory, 'approved-plan.json'),
    primary: join(directory, 'primary.json'),
    ghPages: join(directory, 'gh-pages.json'),
    ghCommand: join(directory, 'gh-command.txt'),
    bundle: join(directory, 'bundle.json'),
    manifest: join(directory, 'manifest.json')
  };
  await Promise.all([
    writeFile(paths.approvedPlan, JSON.stringify({ plan_binding_created: true, plan_binding: { algorithm: 'sha256', digest } })),
    writeFile(paths.primary, JSON.stringify({ complete: true, reason: 'exhausted_pagination', commitSha, pagesFetched: 1, runs: [run] })),
    writeFile(paths.ghPages, JSON.stringify([{ total_count: 1, workflow_runs: [run] }])),
    writeFile(paths.ghCommand, `gh api repos/o/r/actions/runs -f head_sha=${commitSha} --paginate --slurp\n`)
  ]);
  return paths;
}

function inputs(paths) {
  return {
    approvedPlanPath: paths.approvedPlan,
    commitSha,
    primaryPath: paths.primary,
    ghPagesPath: paths.ghPages,
    ghCommandPath: paths.ghCommand,
    primaryRetrievedAt: '2026-07-13T19:20:00Z',
    ghRetrievedAt: '2026-07-13T19:21:00Z',
    generatedAt: '2026-07-13T19:22:00Z'
  };
}

function args(paths) {
  return [
    '--approved-plan', paths.approvedPlan,
    '--commit', commitSha,
    '--primary', paths.primary,
    '--gh-pages', paths.ghPages,
    '--gh-command', paths.ghCommand,
    '--primary-retrieved-at', '2026-07-13T19:20:00Z',
    '--gh-retrieved-at', '2026-07-13T19:21:00Z',
    '--generated-at', '2026-07-13T19:22:00Z',
    '--bundle-output', paths.bundle,
    '--manifest-output', paths.manifest
  ];
}

test('binds manifest and reconciliation bundle to the approved plan before persistence', async () => {
  const paths = await fixture();
  const result = await buildBoundRetainedEvidence(inputs(paths));
  assert.equal(result.bindingVerification.verified, true);
  assert.equal(result.retainedManifest.plan_binding.digest, digest);
  assert.equal(result.reconciliationBundle.plan_binding.digest, digest);
});

test('fails closed before persistence when approved plan binding is malformed', async () => {
  const paths = await fixture();
  await writeFile(paths.approvedPlan, JSON.stringify({ plan_binding_created: true, plan_binding: { algorithm: 'sha256', digest: 'not-a-digest' } }));
  await assert.rejects(() => buildBoundRetainedEvidence(inputs(paths)), /approved_plan_digest_invalid/);
});

test('writes both retained records once and refuses overwrite', async () => {
  const paths = await fixture();
  await main(args(paths));
  const [bundle, manifest] = await Promise.all([readFile(paths.bundle, 'utf8'), readFile(paths.manifest, 'utf8')]);
  assert.equal(JSON.parse(bundle).binding_verification.verified, true);
  assert.equal(JSON.parse(manifest).binding_verification.verified, true);
  await assert.rejects(() => main(args(paths)), /EEXIST/);
});

test('rejects a single output path for both logical records', async () => {
  const paths = await fixture();
  const argv = args(paths);
  argv[argv.indexOf('--manifest-output') + 1] = paths.bundle;
  await assert.rejects(() => main(argv), /output_paths_must_be_distinct/);
});
