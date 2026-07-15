'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { digest } = require('./verifyPaginationProvenance.v1.cjs');
const { verifyWorkflowEnumerationEvidence } = require('./verifyWorkflowEnumerationEvidence.v1.cjs');

const SHA = 'a'.repeat(40);
const NOW = new Date('2026-07-15T02:00:00Z');

function valid() {
  const runs = [{ id: 1, head_sha: SHA }];
  return {
    request: {
      head_sha: SHA,
      endpoint: '/repos/{owner}/{repo}/actions/runs',
      per_page: 100,
      api_version: '2026-03-10'
    },
    api_version_policy: {
      observed_at: '2026-07-15T01:00:00Z',
      source: 'https://docs.github.com/en/rest/about-the-rest-api/api-versions'
    },
    pages: [{
      page: 1,
      next: null,
      workflow_runs: runs,
      response_sha256: digest(runs)
    }],
    reported_total_count: 1,
    retrieval_complete: true
  };
}

test('accepts only when policy and pagination both verify', () => {
  const result = verifyWorkflowEnumerationEvidence(valid(), NOW);
  assert.equal(result.verified, true);
  assert.equal(result.classification, 'workflow_enumeration_evidence_verified');
});

test('rejects invented date-shaped API version before pagination promotion', () => {
  const input = valid();
  input.request.api_version = '2025-01-01';
  const result = verifyWorkflowEnumerationEvidence(input, NOW);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('api_version_policy:unsupported_or_unrecognized_api_version'));
  assert.equal(result.pagination_provenance, null);
});

test('rejects stale API policy observation before pagination promotion', () => {
  const input = valid();
  input.api_version_policy.observed_at = '2026-05-01T00:00:00Z';
  const result = verifyWorkflowEnumerationEvidence(input, NOW);
  assert.ok(result.reasons.includes('api_version_policy:policy_observation_stale'));
  assert.equal(result.pagination_provenance, null);
});

test('rejects valid policy with invalid pagination', () => {
  const input = valid();
  input.retrieval_complete = false;
  const result = verifyWorkflowEnumerationEvidence(input, NOW);
  assert.ok(result.reasons.includes('pagination_provenance:retrieval_not_declared_complete'));
  assert.equal(result.api_version_policy.verified, true);
});

test('rejects legacy version after support window ends', () => {
  const input = valid();
  input.request.api_version = '2022-11-28';
  input.api_version_policy.observed_at = '2028-03-10T00:00:00Z';
  const result = verifyWorkflowEnumerationEvidence(input, new Date('2028-03-10T00:00:01Z'));
  assert.ok(result.reasons.includes('api_version_policy:api_version_support_window_ended'));
});
