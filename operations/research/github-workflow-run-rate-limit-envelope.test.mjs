import assert from 'node:assert/strict';
import test from 'node:test';
import { assessWorkflowRunRateLimitEnvelope } from './github-workflow-run-rate-limit-envelope.mjs';

const headers = (overrides = {}) => ({
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4998',
  'x-ratelimit-used': '2',
  'x-ratelimit-reset': '1783969200',
  'x-ratelimit-resource': 'core',
  ...overrides,
});

test('accepts contiguous successful retained pages with one terminal page', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: false, headers: headers() },
    { page: 2, status: 200, terminal: true, headers: headers({ 'x-ratelimit-remaining': '4997', 'x-ratelimit-used': '3' }) },
  ] }, { nowEpochSeconds: 1783962000 });
  assert.equal(result.ok, true);
  assert.equal(result.classification, 'rate_limit_proven_nonblocking_for_retained_pages');
  assert.equal(result.page_count, 2);
});

test('rejects a 429 response', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 429, terminal: true, headers: headers({ 'retry-after': '60' }) },
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'rate_limited_response');
});

test('rejects missing rate-limit headers', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: true, headers: { 'x-ratelimit-limit': '5000' } },
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'missing_rate_limit_headers');
});

test('rejects zero remaining budget before terminal page', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: false, headers: headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-used': '5000' }) },
    { page: 2, status: 200, terminal: true, headers: headers() },
  ] }, { nowEpochSeconds: 1783962000 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'pagination_budget_exhausted');
});

test('rejects retry-after even on a nominally successful response', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: true, headers: headers({ 'retry-after': '60' }) },
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'retry_after_present');
});

test('rejects resource drift across retained pages', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: false, headers: headers() },
    { page: 2, status: 200, terminal: true, headers: headers({ 'x-ratelimit-resource': 'search' }) },
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'rate_limit_resource_drift');
});

test('rejects a page gap', () => {
  const result = assessWorkflowRunRateLimitEnvelope({ pages: [
    { page: 1, status: 200, terminal: false, headers: headers() },
    { page: 3, status: 200, terminal: true, headers: headers() },
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'page_gap');
});
