import assert from 'node:assert/strict';
import { validateWorkflowPaginationUrl } from './validate-workflow-pagination-url.mjs';

const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'a'.repeat(40),
  expected_page: 2,
  expected_per_page: 100
};

const cases = [
  ['accepts canonical ordering', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2` });
    assert.equal(result.verified, true);
  }],
  ['accepts reordered equivalent parameters', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?page=2&per_page=100&head_sha=${base.commit_sha}` });
    assert.equal(result.verified, true);
  }],
  ['rejects an extra filter', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2&status=success` });
    assert.equal(result.reason, 'unexpected_query_parameter');
  }],
  ['rejects duplicate page parameters', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2&page=3` });
    assert.equal(result.reason, 'duplicate_query_parameter');
  }],
  ['rejects a cross-commit continuation', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?head_sha=${'b'.repeat(40)}&per_page=100&page=2` });
    assert.equal(result.reason, 'commit_filter_mismatch');
  }],
  ['rejects a different origin', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://example.com/repos/${base.repository}/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2` });
    assert.equal(result.reason, 'unexpected_origin');
  }],
  ['rejects encoded path drift', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/MirrorCartographer%2Fmirror-cartographer-ui/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2` });
    assert.equal(result.reason, 'unexpected_path');
  }],
  ['rejects fragments', () => {
    const result = validateWorkflowPaginationUrl({ ...base, url: `https://api.github.com/repos/${base.repository}/actions/runs?head_sha=${base.commit_sha}&per_page=100&page=2#x` });
    assert.equal(result.reason, 'fragment_forbidden');
  }]
];

let passed = 0;
for (const [name, test] of cases) {
  test();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}
console.log(`${passed} passed, 0 failed`);
