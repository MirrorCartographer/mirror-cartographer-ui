import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBoundAuthenticatedEvidenceManifest } from '../tools/write-bound-vercel-authenticated-evidence-manifest.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const commit = 'a'.repeat(40);

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'promotion-rejection-'));
  const primary = Buffer.from('[{"id":1}]');
  const independent = Buffer.from('[[{"id":1}]]');
  await writeFile(join(cwd, 'primary.json'), primary);
  await writeFile(join(cwd, 'independent.json'), independent);
  const inputPath = join(cwd, 'input.json');
  const outputPath = join(cwd, 'output.json');
  const input = {
    commit_sha: commit,
    captured_at: '2026-07-14T01:03:00Z',
    policy: { max_execution_completion_skew_ms: 120000, max_stabilization_gap_ms: 60000 },
    stabilization: { first_snapshot_at: '2026-07-14T01:02:00Z', second_snapshot_at: '2026-07-14T01:02:30Z' },
    primary: {
      raw_output_path: 'primary.json', raw_output_sha256: digest(primary),
      execution: { client_id:'client-a', client_version:'1', invocation_id:'run-a', runner_id:'runner-a', commit_sha:commit, started_at:'2026-07-14T01:00:00Z', completed_at:'2026-07-14T01:00:05Z', command_argv:['node','a.mjs'], environment_class:'authenticated_repository_read' }
    },
    independent: {
      raw_output_path: 'independent.json', raw_output_sha256: digest(independent),
      execution: { client_id:'client-b', client_version:'1', invocation_id:'run-b', runner_id:'runner-b', commit_sha:commit, started_at:'2026-07-14T01:01:00Z', completed_at:'2026-07-14T01:01:04Z', command_argv:['node','b.mjs'], environment_class:'authenticated_repository_read' }
    }
  };
  return { cwd, input, inputPath, outputPath };
}

async function rejectWithoutReplacement(stage, mutate) {
  const value = await fixture();
  mutate(value.input);
  const marker = 'unchanged\n';
  await writeFile(value.inputPath, JSON.stringify(value.input));
  await writeFile(value.outputPath, marker);
  const result = await writeBoundAuthenticatedEvidenceManifest({ input_path:value.inputPath, output_path:value.outputPath, evidence_root:value.cwd });
  assert.equal(result.verified, false);
  assert.equal(result.failed_stage, stage);
  assert.equal(await readFile(value.outputPath, 'utf8'), marker);
}

test('temporal rejection leaves destination byte-identical', async () => {
  await rejectWithoutReplacement('temporal_coherence', input => { input.captured_at = '2026-07-14T01:00:30Z'; });
});

test('observation-window rejection leaves destination byte-identical', async () => {
  await rejectWithoutReplacement('observation_window', input => { input.stabilization.first_snapshot_at = '2026-07-14T01:00:30Z'; });
});
