import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVercelRetainedRateLimitProof } from './assess-vercel-retained-rate-limit-proof.mjs';

function page(pageNumber, { terminal = false, remaining = 4999, resource = 'core', status = 200, retryAfter } = {}) {
  const headers = {
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-used': String(5000 - remaining),
    'x-ratelimit-reset': '2000000000',
    'x-ratelimit-resource': resource,
  };
  if (retryAfter !== undefined) headers['retry-after'] = String(retryAfter);
  return { page: pageNumber, terminal, status, headers };
}

function envelope(pages) {
  return { pages };
}

const options = { nowEpochSeconds: 1900000000 };

test('accepts coherent retained rate-limit proof from both clients', () => {
  const result = assessVercelRetainedRateLimitProof({
    primary: envelope([page(1), page(2, { terminal: true, remaining: 4998 })]),
    independent: envelope([page(1, { terminal: true, remaining: 4997 })]),
  }, options);

  assert.equal(result.ok, true);
  assert.equal(result.promotion_permitted, true);
  assert.equal(result.resource, 'core');
  assert.equal(result.clients.primary.page_count, 2);
  assert.equal(result.clients.independent.page_count, 1);
});

test('fails closed when primary client is rate limited', () => {
  const result = assessVercelRetainedRateLimitProof({
    primary: envelope([page(1, { terminal: true, status: 429, remaining: 0, retryAfter: 60 })]),
    independent: envelope([page(1, { terminal: true })]),
  }, options);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'primary_rate_limit_proof_failed');
  assert.equal(result.failed_client, 'primary');
  assert.equal(result.upstream.code, 'rate_limited_response');
});

test('fails closed when independent client lacks terminal proof', () => {
  const result = assessVercelRetainedRateLimitProof({
    primary: envelope([page(1, { terminal: true })]),
    independent: envelope([page(1)]),
  }, options);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'independent_rate_limit_proof_failed');
  assert.equal(result.upstream.code, 'terminal_page_unproven');
});

test('rejects resource-bucket mismatch between clients', () => {
  const result = assessVercelRetainedRateLimitProof({
    primary: envelope([page(1, { terminal: true, resource: 'core' })]),
    independent: envelope([page(1, { terminal: true, resource: 'search' })]),
  }, options);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'client_resource_mismatch');
  assert.equal(result.primary_resource, 'core');
  assert.equal(result.independent_resource, 'search');
});

test('rejects a successful response carrying retry-after', () => {
  const result = assessVercelRetainedRateLimitProof({
    primary: envelope([page(1, { terminal: true, retryAfter: 10 })]),
    independent: envelope([page(1, { terminal: true })]),
  }, options);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'primary_rate_limit_proof_failed');
  assert.equal(result.upstream.code, 'retry_after_present');
});
