import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthenticatedPaginationEvidence } from './authenticated-pagination-evidence-gate.mjs';

const sha40 = 'a'.repeat(40);
const digest = (c) => c.repeat(64);

function receipt(kind, receiptDigest) {
  const page2 = `https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha40}&page=2&per_page=100`;
  return {
    verified: true,
    commit_sha: sha40,
    page_count: 2,
    record_count: 101,
    raw_output_sha256: digest(kind),
    receipt_sha256: digest(receiptDigest),
    pages: [
      {
        page_number: 1,
        request_url: `https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha40}&page=1&per_page=100&method=${kind}`,
        next_url: `${page2}&method=${kind}`,
        status: 200,
        request_id: `${kind}-1`,
        body_sha256: digest('c'),
        api_version_requested: '2022-11-28',
        api_version_selected: '2022-11-28'
      },
      {
        page_number: 2,
        request_url: `${page2}&method=${kind}`,
        next_url: null,
        status: 200,
        request_id: `${kind}-2`,
        body_sha256: digest('d'),
        api_version_requested: '2022-11-28',
        api_version_selected: '2022-11-28'
      }
    ]
  };
}

function validInput() {
  return {
    commit_sha: sha40,
    primary: { commit_sha: sha40, page_count: 2, record_count: 101, raw_output_sha256: digest('a') },
    independent: { commit_sha: sha40, page_count: 2, record_count: 101, raw_output_sha256: digest('b') },
    transport_receipts: {
      primary: receipt('a', 'e'),
      independent: receipt('b', 'f')
    }
  };
}

test('accepts two continuous independently bound receipts', () => {
  const result = validateAuthenticatedPaginationEvidence(validInput());
  assert.equal(result.verified, true);
  assert.equal(result.reason, 'authenticated_pagination_evidence_valid');
});

test('rejects disconnected primary pagination before transport promotion', () => {
  const input = validInput();
  input.transport_receipts.primary.pages[0].next_url = 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?page=99';
  const result = validateAuthenticatedPaginationEvidence(input);
  assert.deepEqual({ verified: result.verified, reason: result.reason, method: result.method, chain_reason: result.chain_reason }, {
    verified: false,
    reason: 'pagination_chain_integrity_failed',
    method: 'primary',
    chain_reason: 'pagination_chain_discontinuity'
  });
});

test('rejects replayed independent request URL', () => {
  const input = validInput();
  input.transport_receipts.independent.pages[1].request_url = input.transport_receipts.independent.pages[0].request_url;
  input.transport_receipts.independent.pages[0].next_url = input.transport_receipts.independent.pages[0].request_url;
  const result = validateAuthenticatedPaginationEvidence(input);
  assert.equal(result.verified, false);
  assert.equal(result.method, 'independent');
  assert.equal(result.chain_reason, 'request_url_replayed');
});

test('rejects credential-bearing request URL', () => {
  const input = validInput();
  input.transport_receipts.primary.pages[0].request_url += '&access_token=secret';
  const result = validateAuthenticatedPaginationEvidence(input);
  assert.equal(result.verified, false);
  assert.equal(result.chain_reason, 'request_url_invalid');
});

test('preserves transport binding failures after chains pass', () => {
  const input = validInput();
  input.transport_receipts.primary.raw_output_sha256 = digest('9');
  const result = validateAuthenticatedPaginationEvidence(input);
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'transport_raw_output_digest_mismatch');
  assert.equal(result.method, 'primary');
});
