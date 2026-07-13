import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assessFreshReconciledVercelEvidence } from './vercel-fresh-evidence-adapter.mjs';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reason(reasons, condition, code) {
  if (condition) reasons.push(code);
}

export async function verifyFreshEvidenceReceipt(receiptPath) {
  const receiptText = await readFile(receiptPath, 'utf8');
  const receipt = JSON.parse(receiptText);
  const reasons = [];

  reason(reasons, receipt?.schema_version !== 1, 'unsupported_schema_version');
  reason(reasons, receipt?.artifact_type !== 'vercel-fresh-evidence-receipt', 'artifact_type_mismatch');
  reason(reasons, typeof receipt?.target_commit_sha !== 'string' || !/^[0-9a-f]{40}$/i.test(receipt.target_commit_sha), 'invalid_target_commit_sha');
  reason(reasons, receipt?.deployment_claim_permitted !== false, 'deployment_claim_ceiling_violated');
  reason(reasons, receipt?.application_deployment_attempted !== false, 'application_deployment_flag_violated');

  const bindings = receipt?.source_bindings;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    reasons.push('source_bindings_missing');
    return { verified: false, receipt_path: receiptPath, receipt_sha256: sha256(receiptText), reasons };
  }

  const names = ['reconciliation', 'primary_observation', 'independent_observation'];
  const texts = {};
  const parsed = {};
  for (const name of names) {
    const binding = bindings[name];
    if (!binding || typeof binding.path !== 'string' || !/^[0-9a-f]{64}$/i.test(binding.sha256 ?? '')) {
      reasons.push(`${name}_binding_invalid`);
      continue;
    }
    try {
      texts[name] = await readFile(binding.path, 'utf8');
      parsed[name] = JSON.parse(texts[name]);
      reason(reasons, sha256(texts[name]) !== binding.sha256, `${name}_digest_mismatch`);
    } catch {
      reasons.push(`${name}_unreadable`);
    }
  }

  if (names.every((name) => parsed[name])) {
    const expectedAssessment = assessFreshReconciledVercelEvidence({
      target_commit_sha: receipt.target_commit_sha,
      target_commit_time: receipt.assessment?.target_commit_time,
      evaluated_at: receipt.generated_at,
      reconciliation: parsed.reconciliation,
      primary_observation: parsed.primary_observation,
      independent_observation: parsed.independent_observation,
      max_observation_age_ms: receipt.assessment?.limits?.max_observation_age_ms,
      max_channel_skew_ms: receipt.assessment?.limits?.max_channel_skew_ms
    });
    reason(reasons, !sameJson(receipt.assessment, expectedAssessment), 'assessment_replay_mismatch');
    const expectedNextGate = expectedAssessment.accepted
      ? 'commit-bound workflow outcome assessment'
      : 'repair rejected evidence inputs';
    reason(reasons, receipt.next_gate !== expectedNextGate, 'next_gate_mismatch');
  }

  return Object.freeze({
    schema_version: 1,
    artifact_type: 'vercel-fresh-evidence-receipt-verification',
    verified: reasons.length === 0,
    receipt_path: receiptPath,
    receipt_sha256: sha256(receiptText),
    target_commit_sha: receipt?.target_commit_sha ?? null,
    deployment_claim_permitted: false,
    application_deployment_attempted: false,
    reasons
  });
}

async function main(argv) {
  if (argv.length !== 1) throw new Error('usage: node verify-vercel-fresh-evidence-receipt.mjs <receipt.json>');
  const result = await verifyFreshEvidenceReceipt(argv[0]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.verified) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
