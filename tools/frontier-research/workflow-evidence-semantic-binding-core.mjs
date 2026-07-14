const JSON_ROLES = Object.freeze([
  'primary_raw_enumeration',
  'independent_raw_pages',
  'primary_envelope',
  'independent_envelope',
  'reconciliation_result',
  'promotion_assessment'
]);

const COMMIT_KEYS = new Set([
  'commit_sha',
  'head_sha',
  'requested_commit_sha',
  'target_commit_sha',
  'source_commit_sha'
]);

function fail(reason, evidenceStrength = 'semantic_binding_invalid') {
  return { verified: false, reason, evidence_strength: evidenceStrength };
}

function collectCommitClaims(value, claims = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCommitClaims(item, claims);
    return claims;
  }
  if (!value || typeof value !== 'object') return claims;
  for (const [key, child] of Object.entries(value)) {
    if (COMMIT_KEYS.has(key) && typeof child === 'string') claims.push({ key, value: child });
    collectCommitClaims(child, claims);
  }
  return claims;
}

function hasArrayAtAnyKey(value, keys) {
  return Boolean(value && typeof value === 'object' && keys.some((key) => Array.isArray(value[key])));
}

function validateRoleShape(role, value) {
  switch (role) {
    case 'primary_raw_enumeration':
      return hasArrayAtAnyKey(value, ['workflow_runs', 'runs', 'items', 'pages'])
        ? null : 'primary_raw_shape_invalid';
    case 'independent_raw_pages':
      return Array.isArray(value) ? null : 'independent_raw_pages_shape_invalid';
    case 'primary_envelope':
    case 'independent_envelope':
      if (!value || typeof value !== 'object' || value.complete !== true) return `${role}_not_complete`;
      return hasArrayAtAnyKey(value, ['workflow_runs', 'runs', 'records', 'items'])
        ? null : `${role}_records_missing`;
    case 'reconciliation_result':
      return value && typeof value === 'object' && value.verified === true && typeof value.reason === 'string'
        ? null : 'reconciliation_not_verified';
    case 'promotion_assessment':
      return value && typeof value === 'object' && value.verified === true && typeof value.evidence_strength === 'string'
        ? null : 'promotion_not_verified';
    default:
      return 'role_unsupported';
  }
}

function validateIndependentCommand(text, commitSha) {
  if (typeof text !== 'string' || text.trim().length === 0) return 'independent_command_missing';
  const requiredTokens = ['gh api', '--paginate', '--slurp', commitSha];
  const missing = requiredTokens.find((token) => !text.includes(token));
  return missing ? `independent_command_token_missing:${missing}` : null;
}

export function verifyWorkflowEvidenceSemanticBinding({ manifest, retainedArtifacts, byteVerification }) {
  if (!byteVerification?.verified) return fail('byte_verification_required', 'semantic_binding_not_attempted');
  if (!manifest || manifest.schema_version !== 1 || manifest.artifact_type !== 'workflow_evidence_retention_manifest') {
    return fail('manifest_invalid');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.commit_sha ?? '')) return fail('commit_sha_invalid');
  if (byteVerification.commit_sha !== manifest.commit_sha) return fail('byte_verification_commit_mismatch');
  if (!retainedArtifacts || typeof retainedArtifacts !== 'object') return fail('retained_artifacts_required');

  const commandError = validateIndependentCommand(retainedArtifacts.independent_command, manifest.commit_sha);
  if (commandError) return fail(commandError, 'independent_method_unproven');

  const verifiedRoles = ['independent_command'];
  for (const role of JSON_ROLES) {
    const text = retainedArtifacts[role];
    if (typeof text !== 'string') return fail(`retained_artifact_missing:${role}`);

    let value;
    try {
      value = JSON.parse(text);
    } catch {
      return fail(`json_parse_failed:${role}`);
    }

    const shapeError = validateRoleShape(role, value);
    if (shapeError) return fail(shapeError, 'semantic_role_mismatch');

    const claims = collectCommitClaims(value);
    if (claims.length === 0) return fail(`commit_claim_missing:${role}`, 'exact_commit_semantics_unproven');
    const mismatch = claims.find((claim) => claim.value !== manifest.commit_sha);
    if (mismatch) return fail(`commit_claim_mismatch:${role}:${mismatch.key}`, 'cross_commit_semantic_payload');

    verifiedRoles.push(role);
  }

  return {
    verified: true,
    reason: 'retained_evidence_semantically_bound_to_roles_and_commit',
    evidence_strength: 'byte_verified_plus_role_shape_and_internal_commit_binding',
    commit_sha: manifest.commit_sha,
    verified_roles: verifiedRoles.sort()
  };
}

export { JSON_ROLES, collectCommitClaims };
