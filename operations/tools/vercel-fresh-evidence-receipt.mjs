import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { assessFreshReconciledVercelEvidence } from './vercel-fresh-evidence-adapter.mjs';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

export async function buildFreshEvidenceReceipt({
  reconciliation_path,
  primary_observation_path,
  independent_observation_path,
  target_commit_sha,
  target_commit_time,
  evaluated_at,
  max_observation_age_ms = 15 * 60 * 1000,
  max_channel_skew_ms = 5 * 60 * 1000
}) {
  const sourcePaths = {
    reconciliation: reconciliation_path,
    primary_observation: primary_observation_path,
    independent_observation: independent_observation_path
  };
  for (const [name, value] of Object.entries(sourcePaths)) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}_path missing`);
  }

  const [reconciliationText, primaryText, independentText] = await Promise.all([
    readFile(reconciliation_path, 'utf8'),
    readFile(primary_observation_path, 'utf8'),
    readFile(independent_observation_path, 'utf8')
  ]);
  const reconciliation = JSON.parse(reconciliationText);
  const primary_observation = JSON.parse(primaryText);
  const independent_observation = JSON.parse(independentText);
  assertObject(reconciliation, 'reconciliation');
  assertObject(primary_observation, 'primary_observation');
  assertObject(independent_observation, 'independent_observation');

  const assessment = assessFreshReconciledVercelEvidence({
    target_commit_sha,
    target_commit_time,
    evaluated_at,
    reconciliation,
    primary_observation,
    independent_observation,
    max_observation_age_ms,
    max_channel_skew_ms
  });

  return Object.freeze({
    schema_version: 1,
    artifact_type: 'vercel-fresh-evidence-receipt',
    generated_at: evaluated_at,
    target_commit_sha,
    source_bindings: Object.freeze({
      reconciliation: Object.freeze({ path: reconciliation_path, sha256: sha256(reconciliationText) }),
      primary_observation: Object.freeze({ path: primary_observation_path, sha256: sha256(primaryText) }),
      independent_observation: Object.freeze({ path: independent_observation_path, sha256: sha256(independentText) })
    }),
    assessment,
    claim_ceiling: assessment.accepted
      ? 'fresh reconciled exact-commit observation; workflow outcome still unassessed'
      : 'fresh exact-commit observation unproven',
    deployment_claim_permitted: false,
    application_deployment_attempted: false,
    next_gate: assessment.accepted ? 'commit-bound workflow outcome assessment' : 'repair rejected evidence inputs'
  });
}

export async function writeFreshEvidenceReceipt(options, outputPath) {
  if (typeof outputPath !== 'string' || outputPath.trim() === '') throw new Error('output_path missing');
  const receipt = await buildFreshEvidenceReceipt(options);
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
  });
  return receipt;
}

async function main(argv) {
  if (argv.length !== 2) {
    throw new Error('usage: node vercel-fresh-evidence-receipt.mjs <request.json> <output.json>');
  }
  const [requestPath, outputPath] = argv;
  const request = JSON.parse(await readFile(requestPath, 'utf8'));
  await writeFreshEvidenceReceipt(request, outputPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
