import assert from 'node:assert/strict';
import { validatePaginationChainIntegrity } from './pagination-chain-integrity.mjs';

const valid = () => ({
  page_count: 2,
  pages: [
    {
      page_number: 1,
      request_url: 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=abc&per_page=100&page=1',
      next_url: 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=abc&per_page=100&page=2'
    },
    {
      page_number: 2,
      request_url: 'https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=abc&per_page=100&page=2',
      next_url: null
    }
  ]
});

assert.equal(validatePaginationChainIntegrity(valid()).verified, true);

const discontinuity = valid();
discontinuity.pages[0].next_url = discontinuity.pages[0].request_url;
assert.equal(validatePaginationChainIntegrity(discontinuity).reason, 'pagination_chain_discontinuity');

const replay = valid();
replay.pages[1].request_url = replay.pages[0].request_url;
replay.pages[0].next_url = replay.pages[0].request_url;
assert.equal(validatePaginationChainIntegrity(replay).reason, 'request_url_replayed');

const credentialLeak = valid();
credentialLeak.pages[0].request_url += '&access_token=secret';
assert.equal(validatePaginationChainIntegrity(credentialLeak).reason, 'request_url_invalid');

const nonterminal = valid();
nonterminal.pages[1].next_url = 'https://api.github.com/repos/example/example/actions/runs?page=3';
assert.equal(validatePaginationChainIntegrity(nonterminal).reason, 'terminal_page_has_next_url');

const wrongCount = valid();
wrongCount.page_count = 3;
assert.equal(validatePaginationChainIntegrity(wrongCount).reason, 'page_count_mismatch');

process.stdout.write('6 tests passed\n');
