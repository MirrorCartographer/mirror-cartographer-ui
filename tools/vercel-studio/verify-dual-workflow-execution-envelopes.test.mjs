import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyDualWorkflowExecutionEnvelopes } from './verify-dual-workflow-execution-envelopes.mjs';

const repository = 'MirrorCartographer/mirror-cartographer-ui';
const commit = 'a'.repeat(40);
const recordsDigest = 'b'.repeat(64);

function envelope(overrides = {}) {
  return {
    schema_version: 1,
    repository,
    commit_sha: commit,
    endpoint: `/repos/${repository}/actions/runs?head_sha=${commit}&per_page=100`,
    api_version: '2022-11-28',
    accept: 'application/vnd.github+json',
    authenticated: true,
    permissions: ['actions:read'],
    retrieved_at: '2026-07-13T21:50:00Z',
    pages: 1,
    total_count: 2,
    records_digest: recordsDigest,
    response_headers: {
      'x-github-api-version-selected': '2022-11-28',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999'
    },
    ...overrides
  };
}

test('accepts two exact-commit envelopes with the same pinned API contract and record identity', () => {
  const result = verifyDualWorkflowExecutionEnvelopes({
    expectedRepository: repository,
    expectedCommitSha: commit,
    primaryEnvelope: envelope(),
    independentEnvelope: envelope({ retrieved_at: '2026-07-13T21:51:00Z' })
  });
  assert.equal(result.verified, true);
  assert.equal(result.reason, 'dual_execution_envelopes_verified');
  assert.equal(result.records_digest, recordsDigest);
});

test('rejects an independently valid envelope for another commit', () => {
  const otherCommit = 'c'.repeat(40);
  const result = verifyDualWorkflowExecutionEnvelopes({
    expectedRepository: repository,
    expectedCommitSha: commit,
    primaryEnvelope: envelope(),
    independentEnvelope: envelope({
      commit_sha: otherCommit,
      endpoint: `/repos/${repository}/actions/runs?head_sha=${otherCommit}&per_page=100`
    })
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'independent_commit_mismatch');
});

test('rejects API-version divergence', () => {
  const result = verifyDualWorkflowExecutionEnvelopes({
    expectedRepository: repository,
    expectedCommitSha: commit,
    primaryEnvelope: envelope(),
    independentEnvelope: envelope({
      api_version: '2023-01-01',
      response_headers: {
        'x-github-api-version-selected': '2023-01-01',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4998'
      }
    })
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'api_version_divergence');
});

test('rejects record-digest divergence', () => {
  const result = verifyDualWorkflowExecutionEnvelopes({
    expectedRepository: repository,
    expectedCommitSha: commit,
    primaryEnvelope: envelope(),
    independentEnvelope: envelope({ records_digest: 'd'.repeat(64) })
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'records_digest_divergence');
});

test('fails closed when authentication evidence is absent', () => {
  const result = verifyDualWorkflowExecutionEnvelopes({
    expectedRepository: repository,
    expectedCommitSha: commit,
    primaryEnvelope: envelope({ authenticated: false }),
    independentEnvelope: envelope()
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'primary_execution_envelope_rejected');
  assert.equal(result.primary.reason, 'authentication_unproven');
});
