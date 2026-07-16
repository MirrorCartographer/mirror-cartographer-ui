import fs from 'node:fs';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { validateImmutableDeploymentEvidence } = require('../frontier-research/vercelImmutableDeploymentEvidence.v1.cjs');

const NON_SUCCESS_STATES = new Set(['queued','building','failed','canceled','skipped','superseded','rate_limited','stale']);

export function assessPromotion(checklist, evidence) {
  const failures = [];
  const requiredChecks = Array.isArray(checklist?.required_checks) ? checklist.required_checks : [];
  const checks = evidence?.checks && typeof evidence.checks === 'object' ? evidence.checks : {};
  const expectedState = checklist?.promotion_requires?.preview_deployment_state ?? 'ready';

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

  for (const name of requiredChecks) {
    if (checks[name]?.status !== 'pass') failures.push(`required_check_not_pass:${name}`);
    if (checks[name]?.commit !== evidence?.preview_commit) failures.push(`required_check_commit_mismatch:${name}`);
  }

  return {
    schema_version: 3,
    promotable: failures.length === 0,
    failures,
    assessed_preview_commit: evidence?.preview_commit ?? null,
    preview_deployment_state: evidence?.preview_deployment_state ?? null,
    immutable_deployment_identity_verified: immutableDeployment.verified,
    immutable_deployment_identity_digest: immutableDeployment.sha256,
    immutable_deployment_identity_claim_boundary: immutableDeployment.claim_boundary,
    immutable_deployment_git_ref: deploymentRef ?? null,
    immutable_deployment_target: deploymentTarget ?? null,
    required_check_count: requiredChecks.length,
    passed_required_check_count: requiredChecks.filter((name) => checks[name]?.status === 'pass' && checks[name]?.commit === evidence?.preview_commit).length
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
