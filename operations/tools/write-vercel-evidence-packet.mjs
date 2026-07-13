import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { buildFreshEvidenceReceipt } from './vercel-fresh-evidence-receipt.mjs';
import { buildEvidenceSubjectManifest } from '../research/evidence-subject-manifest.mjs';

async function assertMissing(path, reason) {
  try {
    await access(path, fsConstants.F_OK);
    throw new Error(reason);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function removeIfPresent(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}_missing`);
}

export async function writeVercelEvidencePacket({
  repository,
  source_commit_sha,
  generated_at,
  receipt_request,
  receipt_output_path,
  manifest_output_path,
  subject_names
}) {
  assertNonEmptyString(repository, 'repository');
  assertNonEmptyString(source_commit_sha, 'source_commit_sha');
  assertNonEmptyString(generated_at, 'generated_at');
  assertNonEmptyString(receipt_output_path, 'receipt_output_path');
  assertNonEmptyString(manifest_output_path, 'manifest_output_path');
  if (!receipt_request || typeof receipt_request !== 'object' || Array.isArray(receipt_request)) {
    throw new Error('receipt_request_missing');
  }
  if (!subject_names || typeof subject_names !== 'object' || Array.isArray(subject_names)) {
    throw new Error('subject_names_missing');
  }

  await Promise.all([
    assertMissing(receipt_output_path, 'receipt_output_exists'),
    assertMissing(manifest_output_path, 'manifest_output_exists')
  ]);

  const receipt = await buildFreshEvidenceReceipt(receipt_request);
  const receiptText = `${JSON.stringify(receipt, null, 2)}\n`;
  let receiptWritten = false;

  try {
    await writeFile(receipt_output_path, receiptText, {
      encoding: 'utf8',
      flag: fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
    });
    receiptWritten = true;

    const artifacts = [
      { name: subject_names.reconciliation, path: receipt_request.reconciliation_path },
      { name: subject_names.primary_observation, path: receipt_request.primary_observation_path },
      { name: subject_names.independent_observation, path: receipt_request.independent_observation_path },
      { name: subject_names.receipt, path: receipt_output_path }
    ];

    const manifest = await buildEvidenceSubjectManifest({
      repository,
      source_commit_sha,
      generated_at,
      artifacts
    });
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(manifest_output_path, manifestText, {
      encoding: 'utf8',
      flag: fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
    });

    return Object.freeze({
      receipt,
      manifest,
      claim_ceiling: 'artifact identity and byte integrity only; workflow outcome, runtime, deployment, audio audibility, and human observation remain unproven',
      deployment_claim_permitted: false,
      application_deployment_attempted: false
    });
  } catch (error) {
    if (receiptWritten) await removeIfPresent(receipt_output_path);
    await removeIfPresent(manifest_output_path);
    throw error;
  }
}

async function main(argv) {
  if (argv.length !== 1) throw new Error('usage: node write-vercel-evidence-packet.mjs <request.json>');
  const request = JSON.parse(await readFile(argv[0], 'utf8'));
  await writeVercelEvidencePacket(request);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
