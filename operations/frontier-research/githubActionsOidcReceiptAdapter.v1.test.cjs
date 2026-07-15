'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateEnvironment,
  expectedFromEnvironment,
  runGitHubActionsOidcReceiptAdapter,
  writeReceiptNoOverwrite
} = require('./githubActionsOidcReceiptAdapter.v1.cjs');

const ENV = {
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.githubusercontent.com/request?x=1',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'authorization-material-not-retained',
  GITHUB_REPOSITORY: 'MirrorCartographer/mirror-cartographer-ui',
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_ID: '12345',
  GITHUB_RUN_ATTEMPT: '2',
  RUNNER_ENVIRONMENT: 'github-hosted'
};

const EXPECTED = {
  audience: 'mirror-cartographer-evidence',
  observed_at_epoch: 1784158200,
  transcript_digests: {
    primary: `sha256:${'1'.repeat(64)}`,
    independent: `sha256:${'2'.repeat(64)}`
  }
};

function readExpected() {
  return JSON.stringify(EXPECTED);
}

test('validates all required GitHub Actions environment values', () => {
  assert.deepEqual(validateEnvironment(ENV), []);
  assert.deepEqual(validateEnvironment({}), [
    'environment:actions_id_token_request_url_missing',
    'environment:actions_id_token_request_token_missing',
    'environment:github_repository_missing',
    'environment:github_sha_missing',
    'environment:github_run_id_missing',
    'environment:github_run_attempt_missing',
    'environment:runner_environment_missing'
  ]);
});

test('derives exact-run identity from runner environment rather than expected JSON', () => {
  assert.deepEqual(expectedFromEnvironment(ENV, EXPECTED), {
    repository: ENV.GITHUB_REPOSITORY,
    workflow_sha: ENV.GITHUB_SHA,
    run_id: ENV.GITHUB_RUN_ID,
    run_attempt: ENV.GITHUB_RUN_ATTEMPT,
    runner_environment: ENV.RUNNER_ENVIRONMENT,
    observed_at_epoch: EXPECTED.observed_at_epoch,
    transcript_digests: EXPECTED.transcript_digests
  });
});

test('passes authorization material in memory and emits only the receipt', async () => {
  let captured;
  const result = await runGitHubActionsOidcReceiptAdapter({
    env: ENV,
    expected_path: '/expected.json',
    read_file: readExpected,
    build_receipt: async input => {
      captured = input;
      return { verified: true, violations: [], receipt: { run_id: ENV.GITHUB_RUN_ID } };
    }
  });

  assert.equal(captured.request_token, ENV.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
  assert.equal(captured.request_url, ENV.ACTIONS_ID_TOKEN_REQUEST_URL);
  assert.equal(captured.expected.workflow_sha, ENV.GITHUB_SHA);
  assert.deepEqual(result, {
    verified: true,
    violations: [],
    receipt: { run_id: ENV.GITHUB_RUN_ID },
    token_retained: false,
    authorization_retained: false,
    claim_boundary: 'verified_github_oidc_exact_run_and_transcript_digest_receipt_only_no_raw_token_process_hardware_deployment_or_content_truth_claims'
  });
  assert.equal(JSON.stringify(result).includes(ENV.ACTIONS_ID_TOKEN_REQUEST_TOKEN), false);
});

test('fails closed when pipeline verification fails', async () => {
  const result = await runGitHubActionsOidcReceiptAdapter({
    env: ENV,
    expected_path: '/expected.json',
    read_file: readExpected,
    build_receipt: async () => ({ verified: false, violations: ['signature:invalid'], receipt: null })
  });
  assert.equal(result.verified, false);
  assert.deepEqual(result.violations, ['pipeline:signature:invalid']);
  assert.equal(result.receipt, null);
});

test('rejects missing transcript digests and invalid observation time', async () => {
  const missingDigests = await runGitHubActionsOidcReceiptAdapter({
    env: ENV,
    expected_path: '/expected.json',
    read_file: () => JSON.stringify({ audience: 'a', observed_at_epoch: 1 }),
    build_receipt: async () => { throw new Error('must not run'); }
  });
  assert.deepEqual(missingDigests.violations, ['expected:transcript_digests_required']);

  const invalidTime = await runGitHubActionsOidcReceiptAdapter({
    env: ENV,
    expected_path: '/expected.json',
    read_file: () => JSON.stringify({ audience: 'a', observed_at_epoch: 0, transcript_digests: {} }),
    build_receipt: async () => { throw new Error('must not run'); }
  });
  assert.deepEqual(invalidTime.violations, ['expected:observed_at_epoch_invalid']);
});

test('writes verified output with no-overwrite and owner-only mode', () => {
  const calls = [];
  writeReceiptNoOverwrite('/tmp/evidence/receipt.json', {
    verified: true,
    receipt: { run_id: '12345' }
  }, {
    mkdir: (...args) => calls.push(['mkdir', ...args]),
    write_file: (...args) => calls.push(['write', ...args])
  });
  assert.equal(calls[1][3].flag, 'wx');
  assert.equal(calls[1][3].mode, 0o600);
  assert.match(calls[1][2], /"run_id": "12345"/);
});
