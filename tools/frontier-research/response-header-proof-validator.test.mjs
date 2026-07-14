import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDualClientResponseHeaderProof } from './response-header-proof-validator.mjs';

function page(pageIndex, overrides = {}) {
  return {
    page_index: pageIndex,
    status: 200,
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': String(4990 - pageIndex),
      'x-ratelimit-used': String(10 + pageIndex),
      'x-ratelimit-reset': '1784069999',
      'x-ratelimit-resource': 'core',
      ...overrides
    }
  };
}

test('builds accepted proof from complete ordered successful page headers', () => {
  const proof = buildDualClientResponseHeaderProof({
    primaryPages: [page(1), page(2)],
    independentPages: [page(1), page(2)]
  });

  assert.equal(proof.ok, true);
  assert.equal(proof.resource, 'core');
  assert.equal(proof.clients.primary.page_count, 2);
  assert.equal(proof.clients.independent.minimum_remaining, 4988);
});

test('rejects skipped or reordered page indexes', () => {
  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [page(1), page(3)],
      independentPages: [page(1), page(2)]
    }),
    /primary_page_sequence_invalid/
  );
});

test('rejects resource changes inside one client traversal', () => {
  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [page(1), page(2, { 'x-ratelimit-resource': 'actions_runner_registration' })],
      independentPages: [page(1), page(2)]
    }),
    /primary_rate_limit_resource_changed/
  );
});

test('rejects resource disagreement between independent clients', () => {
  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [page(1)],
      independentPages: [page(1, { 'x-ratelimit-resource': 'search' })]
    }),
    /dual_client_rate_limit_resource_mismatch/
  );
});

test('rejects unsuccessful page responses', () => {
  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [{ ...page(1), status: 403 }],
      independentPages: [page(1)]
    }),
    /primary_page_1_status_not_successful/
  );
});

test('returns fail-closed proof when either client observes exhaustion', () => {
  const proof = buildDualClientResponseHeaderProof({
    primaryPages: [page(1, { 'x-ratelimit-remaining': '0' })],
    independentPages: [page(1)]
  });

  assert.equal(proof.ok, false);
  assert.equal(proof.promotion_permitted, false);
  assert.equal(proof.clients.primary.classification, 'primary_limit_exhausted');
});

test('rejects invalid rate-limit arithmetic and regressing reset epochs', () => {
  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [page(1, { 'x-ratelimit-remaining': '5001' })],
      independentPages: [page(1)]
    }),
    /primary_page_1_rate_limit_arithmetic_invalid/
  );

  assert.throws(
    () => buildDualClientResponseHeaderProof({
      primaryPages: [page(1), page(2, { 'x-ratelimit-reset': '1784069998' })],
      independentPages: [page(1), page(2)]
    }),
    /primary_rate_limit_reset_regressed/
  );
});
