import assert from 'node:assert/strict';
import { validateAuthenticatedEvidenceTransportBinding } from './authenticated-evidence-transport-binding.mjs';

const h = (c) => c.repeat(64);
const commit = 'a'.repeat(40);
const page = (number, requestId, body, nextUrl = null) => ({
  page_number: number,
  status: 200,
  request_id: requestId,
  body_sha256: h(body),
  api_version_requested: '2022-11-28',
  api_version_selected: '2022-11-28',
  next_url: nextUrl
});
const method = (digest) => ({ commit_sha: commit, page_count: 1, record_count: 2, raw_output_sha256: h(digest) });
const receipt = (digest, raw, requestId) => ({
  verified: true,
  commit_sha: commit,
  page_count: 1,
  record_count: 2,
  raw_output_sha256: h(raw),
  receipt_sha256: h(digest),
  pages: [page(1, requestId, digest)]
});
const valid = () => ({
  commit_sha: commit,
  primary: method('1'),
  independent: method('2'),
  transport_receipts: {
    primary: receipt('3', '1', 'REQ-primary'),
    independent: receipt('4', '2', 'REQ-independent')
  }
});

assert.equal(validateAuthenticatedEvidenceTransportBinding(valid()).verified, true);

const digestMismatch = valid();
digestMismatch.transport_receipts.primary.raw_output_sha256 = h('9');
assert.equal(validateAuthenticatedEvidenceTransportBinding(digestMismatch).reason, 'transport_raw_output_digest_mismatch');

const apiMismatch = valid();
apiMismatch.transport_receipts.primary.pages[0].api_version_selected = '2026-03-10';
assert.equal(validateAuthenticatedEvidenceTransportBinding(apiMismatch).reason, 'transport_api_version_mismatch');

const notIndependent = valid();
notIndependent.transport_receipts.independent.receipt_sha256 = notIndependent.transport_receipts.primary.receipt_sha256;
assert.equal(validateAuthenticatedEvidenceTransportBinding(notIndependent).reason, 'transport_receipts_not_independent');

const nonterminal = valid();
nonterminal.transport_receipts.primary.pages[0].next_url = 'https://api.github.com/next';
assert.equal(validateAuthenticatedEvidenceTransportBinding(nonterminal).reason, 'transport_chain_nonterminal');

process.stdout.write('5 tests passed\n');
