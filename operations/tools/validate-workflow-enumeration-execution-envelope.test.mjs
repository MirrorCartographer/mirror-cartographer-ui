import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflowEnumerationExecutionEnvelope } from './validate-workflow-enumeration-execution-envelope.mjs';

const sha = 'a'.repeat(40);
const base = {
  schema_version: 1,
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: sha,
  endpoint: `/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100`,
  api_version: '2026-03-10',
  accept: 'application/vnd.github+json',
  authenticated: true,
  permissions: ['actions:read'],
  retrieved_at: '2026-07-13T21:44:00Z',
  pages: 1,
  total_count: 4,
  records_digest: 'b'.repeat(64),
  response_headers: {
    'x-github-api-version-selected': '2026-03-10',
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4990'
  }
};

test('accepts an authenticated exact-commit version-pinned envelope', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope(base);
  assert.equal(result.verified, true);
  assert.equal(result.reason, 'execution_envelope_verified');
  assert.match(result.execution_digest, /^[0-9a-f]{64}$/);
});

test('rejects an unversioned request', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope({ ...base, api_version: null });
  assert.deepEqual(result, { verified: false, reason: 'api_version_not_explicit' });
});

test('rejects a response that does not confirm the selected API version', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope({
    ...base,
    response_headers: { ...base.response_headers, 'x-github-api-version-selected': '2022-11-28' }
  });
  assert.deepEqual(result, { verified: false, reason: 'api_version_response_unconfirmed' });
});

test('rejects an API version under deprecation or sunset', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope({
    ...base,
    response_headers: { ...base.response_headers, sunset: 'Tue, 10 Mar 2028 00:00:00 GMT' }
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'api_version_deprecation_active');
});

test('rejects the documented filtered-search provider ceiling', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope({ ...base, total_count: 1000, pages: 10 });
  assert.deepEqual(result, {
    verified: false,
    reason: 'provider_ceiling_ambiguous',
    total_count: 1000
  });
});

test('rejects evidence without authenticated Actions read permission', () => {
  const result = validateWorkflowEnumerationExecutionEnvelope({ ...base, permissions: [] });
  assert.deepEqual(result, { verified: false, reason: 'actions_read_permission_unproven' });
});
