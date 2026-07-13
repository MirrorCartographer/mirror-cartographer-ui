import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVercelWorkflowEvidenceEnvelope } from './build-vercel-workflow-evidence-envelope.mjs';

const commitSha = 'a'.repeat(40);
const command = `gh api --paginate --slurp -H X-GitHub-Api-Version:2022-11-28 repos/MirrorCartographer/mirror-cartographer-ui/actions/runs -f head_sha=${commitSha} -f per_page=100`;

function contract(overrides = {}) {
  return {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    head_sha: commitSha,
    api_version: '2022-11-28',
    documented_api_version: '2022-11-28',
    documentation_checked_on: '2026-07-13',
    per_page: 100,
    pagination: 'all_pages',
    command,
    source_url: 'https://docs.github.com/en/rest/actions/workflow-runs',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    query_contract: contract(),
    commit_sha: commitSha,
    command,
    pages: [{ total_count: 1, workflow_runs: [{ id: 7, head_sha: commitSha, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 9, run_attempt: 1 }] }],
    ...overrides,
  };
}

const now = '2026-07-13T17:30:00Z';

test('accepts only when query contract and retained pages both pass', () => {
  const result = buildVercelWorkflowEvidenceEnvelope(input(), { now });
  assert.equal(result.complete, true);
  assert.equal(result.query_contract.ok, true);
  assert.equal(result.pagination_envelope.complete, true);
});

test('rejects stale source contract before interpreting pages', () => {
  const value = input();
  value.query_contract = contract({ documentation_checked_on: '2026-05-01' });
  const result = buildVercelWorkflowEvidenceEnvelope(value, { now, maxAgeDays: 30 });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'query_contract_rejected');
  assert.equal(result.contract.code, 'stale_documentation_contract');
});

test('rejects narrowed event coverage', () => {
  const narrowed = `${command} -f event=push`;
  const value = input({ command: narrowed });
  value.query_contract = contract({ command: narrowed });
  const result = buildVercelWorkflowEvidenceEnvelope(value, { now });
  assert.equal(result.complete, false);
  assert.equal(result.contract.code, 'narrowed_event_coverage');
});

test('rejects query and requested commit mismatch', () => {
  const result = buildVercelWorkflowEvidenceEnvelope(input({ commit_sha: 'b'.repeat(40) }), { now });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'query_commit_mismatch');
});

test('rejects retained command mismatch', () => {
  const result = buildVercelWorkflowEvidenceEnvelope(input({ command: `${command} ` }), { now });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'retained_command_mismatch');
});

test('rejects incomplete retained pagination', () => {
  const result = buildVercelWorkflowEvidenceEnvelope(input({ pages: [{ total_count: 2, workflow_runs: [] }] }), { now });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'pagination_envelope_rejected');
  assert.equal(result.envelope.reason, 'pagination_count_mismatch');
});
