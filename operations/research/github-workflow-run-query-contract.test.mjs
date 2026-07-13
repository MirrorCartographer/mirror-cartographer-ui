import assert from 'node:assert/strict';
import test from 'node:test';
import { assessWorkflowRunQueryContract } from './github-workflow-run-query-contract.mjs';

const sha = 'a'.repeat(40);
const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  head_sha: sha,
  api_version: '2026-03-10',
  documented_api_version: '2026-03-10',
  documentation_checked_on: '2026-07-13',
  per_page: 100,
  pagination: 'all_pages',
  source_url: 'https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-repository',
  command: `gh api --paginate --slurp -H X-GitHub-Api-Version:2026-03-10 "repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100"`,
};

const now = '2026-07-13T17:24:00Z';

test('accepts a current explicit all-page exact-commit query contract', () => {
  const result = assessWorkflowRunQueryContract(base, { now });
  assert.equal(result.ok, true);
  assert.match(result.contract_sha256, /^[0-9a-f]{64}$/);
});

test('rejects API-version drift', () => {
  const result = assessWorkflowRunQueryContract({ ...base, api_version: '2022-11-28', command: base.command.replace('2026-03-10', '2022-11-28') }, { now });
  assert.equal(result.code, 'api_version_drift');
});

test('rejects stale source checks', () => {
  const result = assessWorkflowRunQueryContract({ ...base, documentation_checked_on: '2026-05-01' }, { now, maxAgeDays: 30 });
  assert.equal(result.code, 'stale_documentation_contract');
});

test('rejects first-page-only commands', () => {
  const result = assessWorkflowRunQueryContract({ ...base, command: base.command.replace('--paginate --slurp ', '') }, { now });
  assert.equal(result.code, 'command_contract_mismatch');
});

test('rejects event narrowing that would miss other trigger types', () => {
  const result = assessWorkflowRunQueryContract({ ...base, command: `${base.command}&event=pull_request` }, { now });
  assert.equal(result.code, 'narrowed_event_coverage');
});

test('rejects non-maximal page size', () => {
  const result = assessWorkflowRunQueryContract({ ...base, per_page: 30, command: base.command.replace('per_page=100', 'per_page=30') }, { now });
  assert.equal(result.code, 'non_maximal_page_size');
});
