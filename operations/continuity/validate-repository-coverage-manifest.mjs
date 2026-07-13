import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function validateRepositoryCoverageManifest(manifest) {
  const errors = [];
  if (!manifest || manifest.schema_version !== 1) errors.push('schema_version must equal 1');
  if (manifest?.queue_item !== 'M-RECONCILE-002') errors.push('queue_item must equal M-RECONCILE-002');
  if (manifest?.repository !== 'MirrorCartographer/mirror-cartographer-ui') errors.push('repository mismatch');
  if (!['complete', 'bounded', 'failed'].includes(manifest?.coverage_status)) errors.push('invalid coverage_status');
  if (!Array.isArray(manifest?.branches) || manifest.branches.length === 0) errors.push('branches must be non-empty');
  if (!Array.isArray(manifest?.traversals) || manifest.traversals.length === 0) errors.push('traversals must be non-empty');

  const branchNames = new Set();
  for (const branch of manifest?.branches ?? []) {
    if (!branch?.name || !/^[0-9a-f]{40}$/.test(branch?.head_sha ?? '')) errors.push('invalid branch record');
    if (branchNames.has(branch?.name)) errors.push(`duplicate branch ${branch?.name}`);
    branchNames.add(branch?.name);
  }

  const traversalBranches = new Set();
  for (const traversal of manifest?.traversals ?? []) {
    if (!branchNames.has(traversal?.branch)) errors.push(`unknown traversal branch ${traversal?.branch}`);
    if (!Number.isInteger(traversal?.commit_count) || traversal.commit_count < 1) errors.push(`invalid commit_count for ${traversal?.branch}`);
    if (!/^[0-9a-f]{64}$/.test(traversal?.ordered_commit_sha256 ?? '')) errors.push(`invalid ordered_commit_sha256 for ${traversal?.branch}`);
    if (!traversal?.method || !traversal?.retrieved_at) errors.push(`missing traversal provenance for ${traversal?.branch}`);
    if (traversalBranches.has(traversal?.branch)) errors.push(`duplicate traversal ${traversal?.branch}`);
    traversalBranches.add(traversal?.branch);
  }

  const missing = [...branchNames].filter((name) => !traversalBranches.has(name));
  if (missing.length) errors.push(`untraversed branches: ${missing.join(',')}`);

  if (manifest?.coverage_status === 'complete') {
    if (manifest?.branch_enumeration?.exhaustive !== true) errors.push('complete coverage requires exhaustive branch enumeration');
    if (manifest?.branch_enumeration?.provider_ceiling_ambiguous === true) errors.push('complete coverage forbids provider ceiling ambiguity');
    if (missing.length) errors.push('complete coverage requires every branch traversed');
  }

  for (const id of ['M-004', 'M-005', 'M-006']) {
    const result = manifest?.identifier_results?.[id];
    if (!result || !['located', 'unlocated', 'collision_rejected'].includes(result.status)) errors.push(`invalid identifier result for ${id}`);
    if (result?.status === 'located' && !result?.immutable_locator) errors.push(`located ${id} requires immutable_locator`);
    if (result?.status === 'unlocated' && manifest?.coverage_status !== 'complete') errors.push(`unlocated ${id} requires complete coverage`);
  }

  const canonical = JSON.stringify({
    repository: manifest?.repository,
    coverage_status: manifest?.coverage_status,
    branches: manifest?.branches,
    traversals: manifest?.traversals,
    identifier_results: manifest?.identifier_results
  });

  return {
    valid: errors.length === 0,
    errors,
    manifest_digest: sha256(canonical),
    claim_ceiling: manifest?.coverage_status === 'complete'
      ? 'Repository-visible history may support located or coverage-qualified unlocated conclusions.'
      : 'Only bounded search conclusions are permitted; absence remains unproven.'
  };
}
