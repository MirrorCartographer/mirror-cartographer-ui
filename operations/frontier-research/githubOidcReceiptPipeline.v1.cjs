'use strict';

const { verifyGitHubOidcJwt, ISSUER } = require('./githubOidcJwtVerifier.v1.cjs');
const { assessGitHubOidcRunnerBinding } = require('./githubOidcRunnerBinding.v1.cjs');

const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

function rejected(violations) {
  return {
    verified: false,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    token_retained: false,
    claim_boundary: 'oidc_pipeline_rejected_no_identity_runner_process_hardware_or_transcript_truth_claim'
  };
}

function assertHttpsUrl(value, label, expectedHost) {
  let url;
  try { url = new URL(value); } catch { return `${label}:url_invalid`; }
  if (url.protocol !== 'https:') return `${label}:https_required`;
  if (expectedHost && url.hostname !== expectedHost) return `${label}:host_mismatch`;
  return null;
}

async function readJson(response, label) {
  if (!response || response.ok !== true) throw new Error(`${label}:http_not_ok`);
  try { return await response.json(); }
  catch { throw new Error(`${label}:json_invalid`); }
}

async function buildGitHubOidcBoundReceipt(input) {
  const v = [];
  if (!input || typeof input.fetch_impl !== 'function') return rejected(['pipeline:fetch_missing']);
  if (typeof input.request_url !== 'string') v.push('token_request:url_missing');
  if (typeof input.request_token !== 'string' || input.request_token.length < 16) v.push('token_request:authorization_missing');
  if (typeof input.audience !== 'string' || !input.audience) v.push('token_request:audience_missing');
  const requestUrlViolation = typeof input.request_url === 'string'
    ? assertHttpsUrl(input.request_url, 'token_request', 'token.actions.githubusercontent.com')
    : null;
  if (requestUrlViolation) v.push(requestUrlViolation);
  if (v.length) return rejected(v);

  const fetchImpl = input.fetch_impl;
  let discovery;
  try {
    discovery = await readJson(await fetchImpl(DISCOVERY_URL, { headers: { accept: 'application/json' } }), 'discovery');
  } catch (error) { return rejected([error.message]); }

  if (discovery.issuer !== ISSUER) v.push('discovery:issuer_mismatch');
  const jwksViolation = assertHttpsUrl(discovery.jwks_uri, 'discovery_jwks', 'token.actions.githubusercontent.com');
  if (jwksViolation) v.push(jwksViolation);
  if (v.length) return rejected(v);

  let jwks;
  try {
    jwks = await readJson(await fetchImpl(discovery.jwks_uri, { headers: { accept: 'application/json' } }), 'jwks');
  } catch (error) { return rejected([error.message]); }

  const tokenUrl = new URL(input.request_url);
  tokenUrl.searchParams.set('audience', input.audience);
  let tokenEnvelope;
  try {
    tokenEnvelope = await readJson(await fetchImpl(tokenUrl.toString(), {
      headers: { authorization: `bearer ${input.request_token}`, accept: 'application/json' }
    }), 'token_request');
  } catch (error) { return rejected([error.message]); }

  const token = tokenEnvelope && tokenEnvelope.value;
  if (typeof token !== 'string') return rejected(['token_response:value_missing']);

  const signature = verifyGitHubOidcJwt({
    token,
    jwks,
    audience: input.audience,
    observed_at_epoch: input.expected && input.expected.observed_at_epoch
  });
  if (!signature.verified) return rejected(signature.violations.map(x => `signature:${x}`));

  const binding = assessGitHubOidcRunnerBinding({
    signature_verification: signature.signature_verification,
    verified_oidc_claims: signature.claims,
    expected: { ...(input.expected || {}), audience: input.audience }
  });
  if (!binding.verified) return rejected(binding.violations.map(x => `binding:${x}`));

  return {
    verified: true,
    violations: [],
    receipt: binding.receipt,
    token_retained: false,
    token_value_emitted: false,
    discovery_url: DISCOVERY_URL,
    jwks_uri: discovery.jwks_uri,
    claim_boundary: 'github_oidc_rs256_discovery_jwks_exact_run_and_transcript_digest_binding_only_no_same_process_hardware_or_content_truth_claims'
  };
}

module.exports = { buildGitHubOidcBoundReceipt, DISCOVERY_URL, assertHttpsUrl };
