import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Utf8, verifyGitHubPageChain } from './github-page-chain-receipt.mjs';

const body1 = JSON.stringify({ total_count: 2, workflow_runs: [{ id: 1 }] });
const body2 = JSON.stringify({ total_count: 2, workflow_runs: [{ id: 2 }] });
const url1 = 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&per_page=1&page=1';
const url2 = 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&per_page=1&page=2';

function validReceipt() {
  return {
    schema_version: 1,
    commit_sha: 'a'.repeat(40),
    requested_api_version: '2026-03-10',
    initial_url: url1,
    pages: [
      { index: 1, url: url1, status: 200, api_version_selected: '2026-03-10', github_request_id: 'REQ:1', etag: 'W/"one"', link: `<${url2}>; rel="next"`, body_utf8: body1, body_sha256: sha256Utf8(body1) },
      { index: 2, url: url2, status: 200, api_version_selected: '2026-03-10', github_request_id: 'REQ:2', etag: 'W/"two"', link: null, body_utf8: body2, body_sha256: sha256Utf8(body2) }
    ]
  };
}

test('accepts a complete version-bound page chain', () => {
  assert.deepEqual(verifyGitHubPageChain(validReceipt()), {
    verified: true,
    page_count: 2,
    request_id_count: 2,
    requested_api_version: '2026-03-10',
    claim_boundary: 'transport_and_pagination_receipt_only'
  });
});

test('rejects a selected API version mismatch', () => {
  const input = validReceipt();
  input.pages[1].api_version_selected = '2022-11-28';
  assert.equal(verifyGitHubPageChain(input).reason, 'api_version_mismatch');
});

test('rejects a broken Link-header chain', () => {
  const input = validReceipt();
  input.pages[0].link = '<https://api.github.com/repos/x/y/actions/runs?page=9>; rel="next"';
  assert.equal(verifyGitHubPageChain(input).reason, 'broken_link_chain');
});

test('rejects retained body mutation', () => {
  const input = validReceipt();
  input.pages[0].body_utf8 += ' ';
  assert.equal(verifyGitHubPageChain(input).reason, 'body_digest_mismatch');
});

test('rejects a truncated final page', () => {
  const input = validReceipt();
  input.pages.pop();
  assert.equal(verifyGitHubPageChain(input).reason, 'truncated_pagination');
});

test('rejects duplicate provider request identifiers', () => {
  const input = validReceipt();
  input.pages[1].github_request_id = input.pages[0].github_request_id;
  assert.equal(verifyGitHubPageChain(input).reason, 'duplicate_request_id');
});
