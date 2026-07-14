import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaginationLinkChainProof } from './pagination-link-chain-validator.mjs';

const page = (page_index, request_url, link) => ({
  page_index,
  request_url,
  headers: link == null ? {} : { link }
});

test('accepts a contiguous chain ending without rel next', () => {
  const proof = buildPaginationLinkChainProof({
    client: 'primary',
    pages: [
      page(1, 'https://api.github.com/repos/o/r/actions/runs?per_page=100&page=1', '<https://api.github.com/repos/o/r/actions/runs?per_page=100&page=2>; rel="next", <https://api.github.com/repos/o/r/actions/runs?per_page=100&page=2>; rel="last"'),
      page(2, 'https://api.github.com/repos/o/r/actions/runs?per_page=100&page=2')
    ]
  });
  assert.equal(proof.ok, true);
  assert.equal(proof.page_count, 2);
  assert.equal(proof.pages[0].relations.next, proof.pages[1].request_url);
});

test('rejects a skipped next target', () => {
  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [
      page(1, 'https://api.github.com/x?page=1', '<https://api.github.com/x?page=3>; rel="next"'),
      page(2, 'https://api.github.com/x?page=2')
    ]
  }), /next_target_mismatch/);
});

test('rejects a non-terminal page without next', () => {
  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [page(1, 'https://api.github.com/x?page=1'), page(2, 'https://api.github.com/x?page=2')]
  }), /next_relation_missing/);
});

test('rejects a terminal page that advertises another page', () => {
  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [page(1, 'https://api.github.com/x?page=1', '<https://api.github.com/x?page=2>; rel="next"')]
  }), /terminal_page_still_has_next_relation/);
});

test('rejects repeated request URLs and malformed link headers', () => {
  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [
      page(1, 'https://api.github.com/x?page=1', '<https://api.github.com/x?page=1>; rel="next"'),
      page(2, 'https://api.github.com/x?page=1')
    ]
  }), /request_url_repeated/);

  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [page(1, 'https://api.github.com/x?page=1', 'not-a-link')]
  }), /link_header_malformed/);
});

test('rejects non-HTTPS evidence URLs', () => {
  assert.throws(() => buildPaginationLinkChainProof({
    client: 'primary',
    pages: [page(1, 'http://api.github.com/x?page=1')]
  }), /url_must_be_https/);
});
