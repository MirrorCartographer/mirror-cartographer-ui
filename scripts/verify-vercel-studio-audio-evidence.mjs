import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_OUTCOMES = ['source_contract', 'browser_regression', 'production_build'];

export function verifyAudioRoutingEvidence(evidence, expected = {}) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, errors: ['evidence must be a JSON object'] };
  }

  if (evidence.schema_version !== 2) errors.push('schema_version must equal 2');
  if (evidence.queue_item !== 'V-001') errors.push('queue_item must equal V-001');
  if (expected.repository && evidence.repository !== expected.repository) {
    errors.push(`repository mismatch: expected ${expected.repository}`);
  }
  if (expected.commitSha && evidence.commit_sha !== expected.commitSha) {
    errors.push(`commit_sha mismatch: expected ${expected.commitSha}`);
  }

  const outcomes = evidence.outcomes;
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) {
    errors.push('outcomes must be an object');
  } else {
    for (const key of REQUIRED_OUTCOMES) {
      if (outcomes[key] !== 'success') errors.push(`${key} must equal success`);
    }
  }

  const derivedPass = Boolean(outcomes) && REQUIRED_OUTCOMES.every((key) => outcomes[key] === 'success');
  if (evidence.verification_passed !== derivedPass) {
    errors.push('verification_passed does not match required outcomes');
  }
  if (evidence.verification_passed !== true) errors.push('verification_passed must equal true');
  if (typeof evidence.evidence_scope !== 'string' || !evidence.evidence_scope.includes('not physical speaker emission')) {
    errors.push('evidence_scope must preserve the physical-speaker limitation');
  }
  if (!evidence.run_id || !evidence.workflow || !evidence.generated_at_utc) {
    errors.push('run_id, workflow, and generated_at_utc are required');
  }

  return { ok: errors.length === 0, errors };
}

export function verifyAudioRoutingEvidenceFile(filePath, expected = {}) {
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return verifyAudioRoutingEvidence(evidence, expected);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('usage: node scripts/verify-vercel-studio-audio-evidence.mjs <evidence.json> [repository] [commit-sha]');
    process.exit(2);
  }
  const result = verifyAudioRoutingEvidenceFile(filePath, {
    repository: process.argv[3] || process.env.GITHUB_REPOSITORY,
    commitSha: process.argv[4] || process.env.GITHUB_SHA,
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('V-001 evidence packet verified');
}
