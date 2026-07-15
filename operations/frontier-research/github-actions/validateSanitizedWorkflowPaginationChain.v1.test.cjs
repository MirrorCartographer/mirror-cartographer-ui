'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSanitizedWorkflowPaginationChain } = require('./validateSanitizedWorkflowPaginationChain.v1.cjs');

const SHA = 'a'.repeat(40);
const VERSION = '2026-03-10';

function responseEvidence(link = null) {
  return {
    classification: 'sanitized_github_response_evidence',
    verified: true,
    request: {
      api_version: VERSION,
      headers: { 'X-GitHub-Api-Version': VERSION }
    },
    response: {
      status: 200,
      headers: { Link: link }
    }
  };
}

function page(pageIndex, requestUrl, records, link = null) {
  return {
    page_index: pageIndex,
    request_url: requestUrl,
    response_evidence: responseEvidence(link),
    records
  };
}

test('accepts a complete two-page sanitized Link chain', () => {
  const first = 'https://api.github.com/repos/o/r/actions/runs?head_sha=' + SHA + '&per_page=100';
  const second = first + '&page=2';
  const result = validateSanitizedWorkflowPaginationChain({
    exact_commit: SHA,
    api_version: VERSION,
    pages: [
      page(1, first, [{ id: 1, head_sha: SHA }], `<${second}>; rel="next"`),
      page(2, second, [{ id: 2, head_sha: SHA }])
    ]
  });
  assert.equal(result.verified, true);
  assert.equal(result.coverage, 'link_chain_complete');
  assert.equal(result.record_count, 2);
});

test('rejects a skipped or substituted request URL', () => {
  const first = 'https://api.github.com/page/1';
  const expectedSecond = 'https://api.github.com/page/2';
  const result = validateSanitizedWorkflowPaginationChain({
    exact_commit: SHA,
    api_version: VERSION,
    pages: [
      page(1, first, [{ id: 1, head_sha: SHA }], `<${expectedSecond}>; rel="next"`),
      page(2, 'https://api.github.com/page/3', [{ id: 2, head_sha: SHA }])
    ]
  });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('page_2_link_chain_mismatch'));
});

test('rejects duplicate run identifiers and cross-commit records', () => {
  const other = 'b'.repeat(40);
  const result = validateSanitizedWorkflowPaginationChain({
    exact_commit: SHA,
    api_version: VERSION,
    pages: [page(1, 'https://api.github.com/page/1', [
      { id: 7, head_sha: SHA },
      { id: 7, head_sha: other }
    ])]
  });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('duplicate_run_id_7'));
  assert.ok(result.reasons.includes('page_1_cross_commit_record'));
});

test('rejects a retained final page that still advertises rel=next', () => {
  const result = validateSanitizedWorkflowPaginationChain({
    exact_commit: SHA,
    api_version: VERSION,
    pages: [page(1, 'https://api.github.com/page/1', [], '<https://api.github.com/page/2>; rel="next"')]
  });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('final_page_has_next_link'));
});

test('rejects an unverified sanitized response envelope', () => {
  const p = page(1, 'https://api.github.com/page/1', []);
  p.response_evidence.verified = false;
  p.response_evidence.classification = 'rejected';
  const result = validateSanitizedWorkflowPaginationChain({
    exact_commit: SHA,
    api_version: VERSION,
    pages: [p]
  });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('page_1_unsanitized_or_unverified_response'));
});
