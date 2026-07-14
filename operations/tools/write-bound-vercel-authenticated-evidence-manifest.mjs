import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidencePromotion } from '../../tools/frontier-research/evidence-promotion-gate.mjs';
import { withBoundInputSnapshot } from './bound-input-snapshot.mjs';
import { writeAuthenticatedEvidenceManifest } from './write-vercel-authenticated-evidence-manifest.mjs';

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

async function validateOutputBoundary(outputPath, evidenceRoot) {
  let canonicalRoot;
  let canonicalParent;
  try {
    canonicalRoot = await realpath(evidenceRoot);
    canonicalParent = await realpath(dirname(resolve(outputPath)));
  } catch (error) {
    return fail('output_boundary_resolution_failed', { code: error?.code ?? 'unknown' });
  }

  const displacement = relative(canonicalRoot, canonicalParent);
  if (displacement === '' || (!displacement.startsWith('..') && !isAbsolute(displacement))) {
    return {
      verified: true,
      reason: 'output_parent_within_evidence_root',
      canonical_evidence_root: canonicalRoot,
      canonical_output_parent: canonicalParent
    };
  }

  return fail('output_parent_outside_evidence_root', {
    canonical_evidence_root: canonicalRoot,
    canonical_output_parent: canonicalParent
  });
}

export async function writeBoundAuthenticatedEvidenceManifest({
  input_path,
  output_path,
  evidence_root = process.cwd(),
  dependencies = {}
}) {
  if (!input_path || !output_path) return fail('input_and_output_paths_required');

  const outputBoundary = await validateOutputBoundary(output_path, evidence_root);
  if (!outputBoundary.verified) return outputBoundary;

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
    evidence_promotion: promotion,
    output_boundary: outputBoundary
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