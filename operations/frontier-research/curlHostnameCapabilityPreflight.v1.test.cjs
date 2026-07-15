'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assessCurlHostnameCapabilityPreflight,
  parseVersion
} = require('./curlHostnameCapabilityPreflight.v1.cjs');

const probe = {
  method: 'HEAD',
  num_redirects: 0,
  response_code: 200,
  ssl_verify_result: 0,
  time_total: 0.12,
  url_effective: 'https://example.vercel.app/'
};

function valid(overrides = {}) {
  return {
    curl_version_output: 'curl 8.10.1 (x86_64-pc-linux-gnu) libcurl/8.10.1 OpenSSL/3.0.0\nRelease-Date: 2024-09-18',
    curl_version_exit_code: 0,
    write_out_probe: probe,
    observed_at: '2026-07-15T21:46:00Z',
    ...overrides
  };
}

test('accepts a curl build that can emit every required metric', () => {
  const result = assessCurlHostnameCapabilityPreflight(valid());
  assert.equal(result.verified, true);
  assert.equal(result.receipt.curl_version, '8.10.1');
  assert.equal(result.receipt.network_transfer_performed, false);
  assert.match(result.receipt.receipt_sha256, /^[a-f0-9]{64}$/);
});

test('rejects 7.71 because method write-out was added in 7.72', () => {
  const result = assessCurlHostnameCapabilityPreflight(valid({ curl_version_output: 'curl 7.71.1 libcurl/7.71.1' }));
  assert.equal(result.verified, false);
  assert.deepEqual(result.violations, ['curl_version:method_metric_unavailable_before_7_72_0']);
});

test('accepts the exact minimum version', () => {
  assert.equal(assessCurlHostnameCapabilityPreflight(valid({ curl_version_output: 'curl 7.72.0 libcurl/7.72.0' })).verified, true);
});

test('rejects missing required probe keys', () => {
  const missing = { ...probe };
  delete missing.method;
  const rejected = assessCurlHostnameCapabilityPreflight(valid({ write_out_probe: missing }));
  assert.equal(rejected.verified, false);
  assert.ok(rejected.violations.includes('write_out_probe:missing_method'));
});

test('rejects failed or unparseable version commands', () => {
  const result = assessCurlHostnameCapabilityPreflight(valid({ curl_version_output: 'not curl', curl_version_exit_code: 2 }));
  assert.equal(result.verified, false);
  assert.deepEqual(result.violations, ['curl_version:command_failed', 'curl_version:unparseable']);
});

test('digest is stable across probe key ordering', () => {
  const reversed = Object.fromEntries(Object.entries(probe).reverse());
  const left = assessCurlHostnameCapabilityPreflight(valid());
  const right = assessCurlHostnameCapabilityPreflight(valid({ write_out_probe: reversed }));
  assert.equal(left.receipt.receipt_sha256, right.receipt.receipt_sha256);
});

test('version parser ignores linked library version', () => {
  assert.deepEqual(parseVersion('curl 8.9.0 libcurl/8.10.1'), { major: 8, minor: 9, patch: 0 });
});
