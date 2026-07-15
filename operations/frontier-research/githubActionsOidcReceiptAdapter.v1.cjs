'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildGitHubOidcBoundReceipt } = require('./githubOidcReceiptPipeline.v1.cjs');

const REQUIRED_ENV = [
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  'GITHUB_REPOSITORY',
  'GITHUB_SHA',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_ATTEMPT',
  'RUNNER_ENVIRONMENT'
];

function rejected(violations) {
  return {
    verified: false,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    token_retained: false,
    authorization_retained: false,
    claim_boundary: 'actions_adapter_rejected_no_oidc_run_process_hardware_deployment_or_transcript_truth_claim'
  };
}

function readExpectedFile(expectedPath, readFile = fs.readFileSync) {
  if (typeof expectedPath !== 'string' || expectedPath.length === 0) {
    throw new Error('expected:path_missing');
  }
  let parsed;
  try {
    parsed = JSON.parse(readFile(expectedPath, 'utf8'));
  } catch {
    throw new Error('expected:json_invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('expected:object_required');
  }
  return parsed;
}

function expectedFromEnvironment(env, expectedFile) {
  const transcriptDigests = expectedFile.transcript_digests;
  if (!transcriptDigests || typeof transcriptDigests !== 'object' || Array.isArray(transcriptDigests)) {
    throw new Error('expected:transcript_digests_required');
  }
  const observedAt = Number(expectedFile.observed_at_epoch);
  if (!Number.isSafeInteger(observedAt) || observedAt <= 0) {
    throw new Error('expected:observed_at_epoch_invalid');
  }
  return {
    repository: env.GITHUB_REPOSITORY,
    workflow_sha: env.GITHUB_SHA,
    run_id: env.GITHUB_RUN_ID,
    run_attempt: env.GITHUB_RUN_ATTEMPT,
    runner_environment: env.RUNNER_ENVIRONMENT,
    observed_at_epoch: observedAt,
    transcript_digests: transcriptDigests
  };
}

function validateEnvironment(env) {
  const violations = [];
  for (const key of REQUIRED_ENV) {
    if (typeof env[key] !== 'string' || env[key].length === 0) {
      violations.push(`environment:${key.toLowerCase()}_missing`);
    }
  }
  return violations;
}

async function runGitHubActionsOidcReceiptAdapter(input = {}) {
  const env = input.env || process.env;
  const environmentViolations = validateEnvironment(env);
  if (environmentViolations.length) return rejected(environmentViolations);

  let expectedFile;
  let expected;
  try {
    expectedFile = readExpectedFile(input.expected_path, input.read_file);
    expected = expectedFromEnvironment(env, expectedFile);
  } catch (error) {
    return rejected([error.message]);
  }

  const audience = expectedFile.audience;
  if (typeof audience !== 'string' || audience.length === 0) {
    return rejected(['expected:audience_missing']);
  }

  const result = await (input.build_receipt || buildGitHubOidcBoundReceipt)({
    fetch_impl: input.fetch_impl || globalThis.fetch,
    request_url: env.ACTIONS_ID_TOKEN_REQUEST_URL,
    request_token: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    audience,
    expected
  });

  if (!result || result.verified !== true || !result.receipt) {
    return rejected(result && Array.isArray(result.violations)
      ? result.violations.map(v => `pipeline:${v}`)
      : ['pipeline:verification_failed']);
  }

  return {
    verified: true,
    violations: [],
    receipt: result.receipt,
    token_retained: false,
    authorization_retained: false,
    claim_boundary: 'verified_github_oidc_exact_run_and_transcript_digest_receipt_only_no_raw_token_process_hardware_deployment_or_content_truth_claims'
  };
}

function writeReceiptNoOverwrite(outputPath, result, options = {}) {
  if (!result || result.verified !== true || !result.receipt) {
    throw new Error('output:verified_receipt_required');
  }
  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    throw new Error('output:path_missing');
  }
  const mkdir = options.mkdir || fs.mkdirSync;
  const writeFile = options.write_file || fs.writeFileSync;
  mkdir(path.dirname(outputPath), { recursive: true });
  writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

module.exports = {
  REQUIRED_ENV,
  validateEnvironment,
  readExpectedFile,
  expectedFromEnvironment,
  runGitHubActionsOidcReceiptAdapter,
  writeReceiptNoOverwrite
};
