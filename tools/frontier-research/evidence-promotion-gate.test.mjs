import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateEvidencePromotion } from './evidence-promotion-gate.mjs';

const cwd = await mkdtemp(join(tmpdir(), 'promotion-gate-'));
const primaryBytes = Buffer.from('[{"id":1}]');
const independentBytes = Buffer.from('[[{"id":1}]]');
await writeFile(join(cwd, 'primary.json'), primaryBytes);
await writeFile(join(cwd, 'independent.json'), independentBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const commit = 'a'.repeat(40);
const base = {
  commit_sha: commit,
  captured_at: '2026-07-14T01:03:00Z',
  policy: { max_execution_completion_skew_ms: 120000, max_stabilization_gap_ms: 60000 },
  stabilization: { first_snapshot_at: '2026-07-14T01:02:00Z', second_snapshot_at: '2026-07-14T01:02:30Z' },
  primary: { raw_output_path: 'primary.json', raw_output_sha256: sha(primaryBytes), execution: { client_id:'github-rest-enumerator',client_version:'1.0.0',invocation_id:'primary-1',runner_id:'runner-a',commit_sha:commit,started_at:'2026-07-14T01:00:00Z',completed_at:'2026-07-14T01:00:05Z',command_argv:['node','enumerate.mjs',commit],environment_class:'authenticated_repository_read' } },
  independent: { raw_output_path: 'independent.json', raw_output_sha256: sha(independentBytes), execution: { client_id:'gh-api-cli',client_version:'2.0.0',invocation_id:'independent-1',runner_id:'runner-b',commit_sha:commit,started_at:'2026-07-14T01:01:00Z',completed_at:'2026-07-14T01:01:04Z',command_argv:['gh','api','--paginate','--slurp'],environment_class:'authenticated_repository_read' } }
};
const copy = value => structuredClone(value);
assert.equal((await validateEvidencePromotion(base,{cwd})).verified,true);
const digest=copy(base);digest.primary.raw_output_sha256='0'.repeat(64);assert.equal((await validateEvidencePromotion(digest,{cwd})).failed_stage,'retained_raw_output_binding');
const provenance=copy(base);provenance.independent.execution.client_id=provenance.primary.execution.client_id;assert.equal((await validateEvidencePromotion(provenance,{cwd})).failed_stage,'independent_execution_provenance');
const temporal=copy(base);temporal.captured_at='2026-07-14T01:00:30Z';assert.equal((await validateEvidencePromotion(temporal,{cwd})).failed_stage,'temporal_coherence');
const window=copy(base);window.stabilization.first_snapshot_at='2026-07-14T01:00:30Z';assert.equal((await validateEvidencePromotion(window,{cwd})).failed_stage,'observation_window');
process.stdout.write('5 promotion-gate assertions passed\n');
