import crypto from 'node:crypto';
import { resolveProvenanceCandidate } from '../tools/resolve-provenance-candidate.mjs';
import { validateRepositoryCoverageManifest } from './validate-repository-coverage-manifest.mjs';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function decideProvenanceStatus({ node, candidates, coverageManifest }) {
  const coverage = validateRepositoryCoverageManifest(coverageManifest);
  const resolution = resolveProvenanceCandidate({ node, candidates });
  const completeCoverage = coverage.valid &&
    coverageManifest.coverage_status === 'complete' &&
    coverageManifest.branch_enumeration?.exhaustive === true &&
    coverageManifest.branch_enumeration?.provider_ceiling_ambiguous === false;

  let status = 'unresolved';
  let claim_status = 'observed';
  let immutable_locator;

  if (resolution.status === 'resolved') {
    status = 'located';
    claim_status = 'observed';
    immutable_locator = resolution.candidate.immutable_locator;
  } else if (resolution.status === 'collision') {
    status = 'collision_rejected';
    claim_status = 'observed';
  } else if (completeCoverage) {
    status = 'unlocated';
    claim_status = 'inferred';
  }

  const basis = stable({
    identifier: node?.identifier ?? null,
    status,
    claim_status,
    immutable_locator: immutable_locator ?? null,
    coverage_valid: coverage.valid,
    coverage_status: coverageManifest?.coverage_status ?? null,
    resolution_digest: resolution.digest
  });

  return {
    status,
    claim_status,
    immutable_locator,
    authoritative: false,
    coverage_valid: coverage.valid,
    coverage_errors: coverage.errors,
    resolution_status: resolution.status,
    digest: crypto.createHash('sha256').update(JSON.stringify(basis)).digest('hex')
  };
}
