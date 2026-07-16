import fs from 'node:fs';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { validateImmutableDeploymentEvidence } = require('../frontier-research/vercelImmutableDeploymentEvidence.v1.cjs');

const NON_SUCCESS_STATES = new Set(['queued','building','failed','canceled','skipped','superseded','rate_limited','stale']);
const CHECK_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export function requiredCheckProfileDigest(requiredChecks) {
  return createHash('sha256').update(JSON.stringify([...requiredChecks].sort())).digest('hex');
}

export function assessPromotion(checklist, evidence, options = {}) {
  const failures = [];
  const requiredChecks = Array.isArray(checklist?.required_checks) ? checklist.required_checks : [];
  const checks = evidence?.checks && typeof evidence.checks === 'object' ? evidence.checks : {};
  const expectedState = checklist?.promotion_requires?.preview_deployment_state ?? 'ready';
  const expectedIdentity = checklist?.expected_deployment_identity ?? {};
  const requiredCheckProfile = checklist?.required_check_profile ?? {};
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxEvidenceAgeMs = checklist?.promotion_requires?.max_deployment_evidence_age_ms;
  const maxRequiredCheckAgeMs = checklist?.promotion_requires?.max_required_check_age_ms;

  if (!Array.isArray(checklist?.required_checks) || requiredChecks.length === 0) failures.push('required_checks_missing_or_empty');
  const malformedCheckIds = requiredChecks.filter((name) => typeof name !== 'string' || !CHECK_ID_PATTERN.test(name));
  if (malformedCheckIds.length > 0) failures.push('required_check_identifier_invalid');
  if (new Set(requiredChecks).size !== requiredChecks.length) failures.push('required_checks_duplicate');
  if (typeof requiredCheckProfile.id !== 'string' || requiredCheckProfile.id.trim() === '') failures.push('required_check_profile_id_missing');
  if (!Number.isInteger(requiredCheckProfile.version) || requiredCheckProfile.version <= 0) failures.push('required_check_profile_version_invalid');
  const calculatedRequiredCheckProfileDigest = requiredCheckProfileDigest(requiredChecks);
  if (!/^[0-9a-f]{64}$/i.test(requiredCheckProfile.sha256 ?? '')) failures.push('required_check_profile_digest_missing_or_invalid');
  else if (requiredCheckProfile.sha256.toLowerCase() !== calculatedRequiredCheckProfileDigest) failures.push('required_check_profile_digest_mismatch');

  if (evidence?.source_branch !== checklist?.source_branch) failures.push('source_branch_mismatch');
  if (evidence?.target_branch !== checklist?.target_branch) failures.push('target_branch_mismatch');
  if (!/^[0-9a-f]{40}$/i.test(evidence?.preview_commit ?? '')) failures.push('invalid_preview_commit');
  if (evidence?.preview_deployment_state !== expectedState) failures.push(`preview_state_not_${expectedState}`);
  if (NON_SUCCESS_STATES.has(evidence?.preview_deployment_state)) failures.push('preview_state_is_non_success');
  if (!evidence?.preview_url || !/^https:\/\//.test(evidence.preview_url)) failures.push('missing_preview_url');
  if (evidence?.deployment_commit !== evidence?.preview_commit) failures.push('deployment_commit_mismatch');
  if (evidence?.evidence_commit !== evidence?.preview_commit) failures.push('evidence_commit_mismatch');
  if (evidence?.unresolved_critical_risks !== 0) failures.push('critical_risks_remaining');
  if (!evidence?.rollback_route_recorded || !evidence?.rollback_route) failures.push('rollback_route_missing');

  const immutableDeployment = validateImmutableDeploymentEvidence(evidence?.deployment_identity_evidence);
  if (!immutableDeployment.verified) failures.push('immutable_deployment_identity_unverified');
  for (const violation of immutableDeployment.violations) failures.push(`immutable_deployment_identity:${violation}`);

  const observedAtMs = Date.parse(immutableDeployment.normalized?.observed_at || '');
  if (!Number.isFinite(maxEvidenceAgeMs) || maxEvidenceAgeMs <= 0) {
    failures.push('deployment_evidence_freshness_policy_missing');
  } else if (Number.isNaN(observedAtMs)) {
    failures.push('deployment_evidence_observed_at_invalid');
  } else {
    const evidenceAgeMs = nowMs - observedAtMs;
    if (evidenceAgeMs < 0) failures.push('deployment_evidence_observed_in_future');
    if (evidenceAgeMs > maxEvidenceAgeMs) failures.push('deployment_evidence_stale');
  }

  const immutableHostname = immutableDeployment.normalized?.deployment?.url;
  const expectedPreviewUrl = immutableHostname ? `https://${immutableHostname}` : null;
  if (expectedPreviewUrl && evidence?.preview_url !== expectedPreviewUrl) failures.push('preview_url_not_immutable_deployment_hostname');
  if (immutableDeployment.normalized?.expected_commit_sha !== String(evidence?.preview_commit || '').toLowerCase()) {
    failures.push('immutable_deployment_expected_commit_mismatch');
  }

  const deploymentRef = immutableDeployment.normalized?.deployment?.gitSource?.ref;
  if (!deploymentRef) failures.push('immutable_deployment_git_ref_missing');
  else if (deploymentRef !== checklist?.source_branch) failures.push('immutable_deployment_source_branch_mismatch');

  const deploymentTarget = immutableDeployment.normalized?.deployment?.target;
  if (deploymentTarget === 'production') failures.push('production_target_cannot_serve_as_preview_evidence');

  const deploymentRepoId = immutableDeployment.normalized?.deployment?.gitSource?.repoId;
  if (expectedIdentity.github_repo_id == null) failures.push('expected_github_repo_id_missing');
  else if (String(deploymentRepoId) !== String(expectedIdentity.github_repo_id)) failures.push('immutable_deployment_github_repo_mismatch');

  const deploymentProjectName = immutableDeployment.normalized?.deployment?.name;
  if (!expectedIdentity.vercel_project_name) failures.push('expected_vercel_project_name_missing');
  else if (deploymentProjectName !== expectedIdentity.vercel_project_name) failures.push('immutable_deployment_project_name_mismatch');

  if (expectedIdentity.vercel_project_id) {
    const deploymentProjectId = immutableDeployment.normalized?.deployment?.projectId;
    if (deploymentProjectId !== expectedIdentity.vercel_project_id) failures.push('immutable_deployment_project_id_mismatch');
  }

  if (!Number.isFinite(maxRequiredCheckAgeMs) || maxRequiredCheckAgeMs <= 0) {
    failures.push('required_check_freshness_policy_missing');
  }

  for (const name of requiredChecks) {
    const check = checks[name];
    if (check?.status !== 'pass') failures.push(`required_check_not_pass:${name}`);
    if (check?.commit !== evidence?.preview_commit) failures.push(`required_check_commit_mismatch:${name}`);
    const checkObservedAtMs = Date.parse(check?.observed_at || '');
    if (Number.isNaN(checkObservedAtMs)) {
      failures.push(`required_check_observed_at_invalid:${name}`);
    } else if (Number.isFinite(maxRequiredCheckAgeMs) && maxRequiredCheckAgeMs > 0) {
      const checkAgeMs = nowMs - checkObservedAtMs;
      if (checkAgeMs < 0) failures.push(`required_check_observed_in_future:${name}`);
      if (checkAgeMs > maxRequiredCheckAgeMs) failures.push(`required_check_stale:${name}`);
    }
  }

  return {
    schema_version: 7,
    promotable: failures.length === 0,
    failures,
    assessed_preview_commit: evidence?.preview_commit ?? null,
    preview_deployment_state: evidence?.preview_deployment_state ?? null,
    required_check_profile_id: requiredCheckProfile.id ?? null,
    required_check_profile_version: requiredCheckProfile.version ?? null,
    required_check_profile_declared_sha256: requiredCheckProfile.sha256 ?? null,
    required_check_profile_calculated_sha256: calculatedRequiredCheckProfileDigest,
    immutable_deployment_identity_verified: immutableDeployment.verified,
    immutable_deployment_identity_digest: immutableDeployment.sha256,
    immutable_deployment_identity_claim_boundary: immutableDeployment.claim_boundary,
    immutable_deployment_git_ref: deploymentRef ?? null,
    immutable_deployment_target: deploymentTarget ?? null,
    immutable_deployment_github_repo_id: deploymentRepoId ?? null,
    immutable_deployment_project_name: deploymentProjectName ?? null,
    deployment_evidence_observed_at: immutableDeployment.normalized?.observed_at ?? null,
    deployment_evidence_max_age_ms: Number.isFinite(maxEvidenceAgeMs) ? maxEvidenceAgeMs : null,
    deployment_evidence_age_ms: Number.isNaN(observedAtMs) ? null : nowMs - observedAtMs,
    required_check_max_age_ms: Number.isFinite(maxRequiredCheckAgeMs) ? maxRequiredCheckAgeMs : null,
    required_check_count: requiredChecks.length,
    passed_required_check_count: requiredChecks.filter((name) => {
      const check = checks[name];
      const checkObservedAtMs = Date.parse(check?.observed_at || '');
      return check?.status === 'pass' && check?.commit === evidence?.preview_commit && !Number.isNaN(checkObservedAtMs) && Number.isFinite(maxRequiredCheckAgeMs) && maxRequiredCheckAgeMs > 0 && nowMs - checkObservedAtMs >= 0 && nowMs - checkObservedAtMs <= maxRequiredCheckAgeMs;
    }).length
  };
}

function readJson(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [checklistPath, evidencePath] = process.argv.slice(2);
  if (!checklistPath || !evidencePath) {
    console.error('usage: node validate-promotion-evidence.v1.mjs <checklist.json> <evidence.json>');
    process.exit(2);
  }
  const result = assessPromotion(readJson(checklistPath), readJson(evidencePath));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.promotable ? 0 : 1);
}
