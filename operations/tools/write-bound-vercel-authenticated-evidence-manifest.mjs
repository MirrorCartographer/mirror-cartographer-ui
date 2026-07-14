import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidencePromotion } from '../../tools/frontier-research/evidence-promotion-gate.mjs';
import { withBoundInputSnapshot } from './bound-input-snapshot.mjs';
import { writeAuthenticatedEvidenceManifest } from './write-vercel-authenticated-evidence-manifest.mjs';

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

export async function writeBoundAuthenticatedEvidenceManifest({
  input_path,
  output_path,
  evidence_root = process.cwd(),
  dependencies = {}
}) {
  if (!input_path || !output_path) return fail('input_and_output_paths_required');

  const readInput = dependencies.read_input ?? (path => readFile(path, 'utf8'));
  const validatePromotion = dependencies.validate_promotion ?? validateEvidencePromotion;
  const bindInputSnapshot = dependencies.bind_input_snapshot ?? withBoundInputSnapshot;
  const writeManifest = dependencies.write_manifest ?? writeAuthenticatedEvidenceManifest;

  let input;
  try {
    input = JSON.parse(await readInput(input_path));
  } catch (error) {
    return fail(error instanceof SyntaxError ? 'input_invalid_json' : 'input_read_failed', { code: error?.code ?? 'unknown' });
  }

  const promotion = await validatePromotion(input, { cwd: evidence_root });
  if (!promotion.verified) return promotion;

  const result = await bindInputSnapshot(
    input,
    snapshotPath => writeManifest({ input_path: snapshotPath, output_path }),
    { temporary_root: evidence_root }
  );
  if (!result.verified) return result;

  return {
    ...result,
    reason: 'promoted_authenticated_evidence_manifest_written',
    evidence_promotion: promotion
  };
}

async function main() {
  const [input_path, output_path, evidence_root] = process.argv.slice(2);
  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path,
    output_path,
    evidence_root: evidence_root ? resolve(evidence_root) : process.cwd()
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.verified ? 0 : 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();