'use strict';

const crypto = require('node:crypto');

const MINIMUM_VERSION = Object.freeze({ major: 7, minor: 72, patch: 0 });
const REQUIRED_METRICS = Object.freeze([
  'method',
  'num_redirects',
  'response_code',
  'ssl_verify_result',
  'time_total',
  'url_effective'
]);

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function parseVersion(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0];
  const match = /^curl\s+(\d+)\.(\d+)\.(\d+)(?:[-\s]|$)/.exec(firstLine);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareVersion(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

function assessCurlHostnameCapabilityPreflight(input) {
  const violations = [];
  const version = parseVersion(input && input.curl_version_output);
  if (!version) violations.push('curl_version:unparseable');
  else if (compareVersion(version, MINIMUM_VERSION) < 0) violations.push('curl_version:method_metric_unavailable_before_7_72_0');

  const versionExitCode = input && input.curl_version_exit_code;
  if (!Number.isInteger(versionExitCode)) violations.push('curl_version:exit_code_invalid');
  else if (versionExitCode !== 0) violations.push('curl_version:command_failed');

  const observedAt = input && input.observed_at;
  if (!(typeof observedAt === 'string' && !Number.isNaN(Date.parse(observedAt)))) violations.push('curl_version:observed_at_invalid');

  const probe = input && input.write_out_probe;
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)) {
    violations.push('write_out_probe:missing_or_invalid');
  } else {
    for (const field of REQUIRED_METRICS) {
      if (!Object.prototype.hasOwnProperty.call(probe, field)) violations.push(`write_out_probe:missing_${field}`);
    }
  }

  if (violations.length) {
    return {
      verified: false,
      violations: [...new Set(violations)].sort(),
      receipt: null,
      claim_boundary: 'curl_capability_rejected_no_hostname_observation_permitted'
    };
  }

  const receiptBase = {
    schema_version: 1,
    source_boundary: 'local_curl_version_and_write_out_probe_v1',
    curl_version: `${version.major}.${version.minor}.${version.patch}`,
    minimum_version: '7.72.0',
    required_metrics: [...REQUIRED_METRICS],
    observed_metric_keys: Object.keys(probe).sort(),
    observed_at: new Date(observedAt).toISOString(),
    version_command: ['curl', '--version'],
    version_exit_code: versionExitCode,
    network_transfer_performed: false,
    credentials_retained: false
  };

  return {
    verified: true,
    violations: [],
    receipt: {
      ...receiptBase,
      receipt_sha256: crypto.createHash('sha256').update(canonicalize(receiptBase)).digest('hex')
    },
    claim_boundary: 'curl_build_can_emit_required_hostname_observation_metrics_only'
  };
}

module.exports = {
  MINIMUM_VERSION,
  REQUIRED_METRICS,
  assessCurlHostnameCapabilityPreflight,
  compareVersion,
  parseVersion
};
