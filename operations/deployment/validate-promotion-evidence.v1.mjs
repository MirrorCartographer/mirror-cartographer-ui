import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const NON_SUCCESS_STATES = new Set(['queued','building','failed','canceled','skipped','superseded']);

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

  for (const name of requiredChecks) {
    if (checks[name]?.status !== 'pass') failures.push(`required_check_not_pass:${name}`);
    if (checks[name]?.commit !== evidence?.preview_commit) failures.push(`required_check_commit_mismatch:${name}`);
  }

  return {
    schema_version: 1,
    promotable: failures.length === 0,
    failures,
    assessed_preview_commit: evidence?.preview_commit ?? null,
    preview_deployment_state: evidence?.preview_deployment_state ?? null,
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
