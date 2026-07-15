'use strict';
const crypto = require('node:crypto');
const SHA256_RE = /^[a-f0-9]{64}$/;
const DECIMAL_ID_RE = /^[1-9][0-9]*$/;
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function reject(violations) { return { verified:false, violations:[...new Set(violations)].sort(), receipt:null, claim_boundary:'runner_oidc_binding_rejected_no_trusted_runner_or_process_integrity_claim' }; }
function assessGitHubOidcRunnerBinding(input) {
  const v=[]; const c=input&&input.verified_oidc_claims; const e=input&&input.expected;
  if (!input || input.signature_verification !== 'externally_verified') v.push('oidc:signature_not_externally_verified');
  if (!c || typeof c !== 'object') return reject([...v,'oidc:claims_missing']);
  if (!e || typeof e !== 'object') return reject([...v,'expected:missing']);
  if (c.iss !== 'https://token.actions.githubusercontent.com') v.push('oidc:issuer_mismatch');
  if (c.aud !== e.audience) v.push('oidc:audience_mismatch');
  if (c.repository !== e.repository) v.push('oidc:repository_mismatch');
  if (String(c.repository_id||'') !== String(e.repository_id||'')) v.push('oidc:repository_id_mismatch');
  if (c.workflow_sha !== e.commit_sha) v.push('oidc:workflow_sha_mismatch');
  if (c.workflow_ref !== e.workflow_ref) v.push('oidc:workflow_ref_mismatch');
  if (String(c.run_id||'') !== String(e.run_id||'')) v.push('oidc:run_id_mismatch');
  if (String(c.run_attempt||'') !== String(e.run_attempt||'')) v.push('oidc:run_attempt_mismatch');
  if (c.runner_environment !== e.runner_environment) v.push('oidc:runner_environment_mismatch');
  if (!DECIMAL_ID_RE.test(String(c.repository_id||''))) v.push('oidc:repository_id_invalid');
  if (!DECIMAL_ID_RE.test(String(c.run_id||''))) v.push('oidc:run_id_invalid');
  if (!DECIMAL_ID_RE.test(String(c.run_attempt||''))) v.push('oidc:run_attempt_invalid');
  if (typeof c.jti !== 'string' || c.jti.length < 8) v.push('oidc:jti_invalid');
  if (!Number.isInteger(c.iat)||!Number.isInteger(c.exp)||c.exp<=c.iat) v.push('oidc:time_window_invalid');
  if (!Number.isInteger(e.observed_at_epoch)|| (Number.isInteger(c.iat)&&e.observed_at_epoch<c.iat) || (Number.isInteger(c.exp)&&e.observed_at_epoch>c.exp)) v.push('oidc:observation_outside_token_window');
  for (const name of ['challenge_receipt_sha256','capability_transcript_sha256','hostname_transcript_sha256']) if(!SHA256_RE.test(e[name]||'')) v.push(`expected:${name}_invalid`);
  if(v.length) return reject(v);
  const base={schema_version:1,source_boundary:'github_actions_oidc_runner_binding_v1',issuer:c.iss,audience:c.aud,repository:c.repository,repository_id:String(c.repository_id),workflow_ref:c.workflow_ref,workflow_sha:c.workflow_sha,run_id:String(c.run_id),run_attempt:String(c.run_attempt),runner_environment:c.runner_environment,jti_sha256:sha256(c.jti),token_iat:c.iat,token_exp:c.exp,observed_at_epoch:e.observed_at_epoch,challenge_receipt_sha256:e.challenge_receipt_sha256,capability_transcript_sha256:e.capability_transcript_sha256,hostname_transcript_sha256:e.hostname_transcript_sha256,external_signature_verification_required:true,token_retention_required:false,same_process_claimed:false,hardware_attestation_claimed:false,transcript_content_truth_claimed:false};
  return {verified:true,violations:[],receipt:{...base,receipt_sha256:sha256(canonicalize(base))},claim_boundary:'externally_verified_github_oidc_identity_and_exact_run_transcript_digest_binding_only_no_same_process_hardware_or_content_truth_claims'};
}
module.exports={assessGitHubOidcRunnerBinding,canonicalize,sha256};
