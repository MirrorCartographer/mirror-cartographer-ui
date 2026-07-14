const allowedEvidence = new Set(['observed', 'inferred', 'proposed']);
const allowedTemporal = new Set(['current', 'superseded']);
const allowedResolution = new Set(['resolved', 'unresolved']);

function fail(message) {
  throw new Error(`CM-1029 validation failed: ${message}`);
}

function validateAxes(claim, label) {
  if (claim == null) return;
  if (typeof claim !== 'object' || Array.isArray(claim)) fail(`${label} must be an object`);
  if ('evidentiary' in claim && !allowedEvidence.has(claim.evidentiary)) fail(`${label}.evidentiary is unknown`);
  if ('temporal' in claim && !allowedTemporal.has(claim.temporal)) fail(`${label}.temporal is unknown`);
  if ('resolution' in claim && !allowedResolution.has(claim.resolution)) fail(`${label}.resolution is unknown`);
}

export function resolveClaimConflict(entry) {
  const { case_id: id, left, right } = entry;
  validateAxes(left, `${id}.left`);
  validateAxes(right, `${id}.right`);

  switch (id) {
    case 'observed_over_inferred':
      if (left?.evidentiary !== 'observed' || left?.immutable_locator !== true || right?.evidentiary !== 'inferred') fail(`${id} preconditions`);
      return { winner: 'left', action: 'retain_both_and_prefer_observed', may_rewrite_historical_observation: false };
    case 'later_decision_supersedes_decision_not_observation':
      if (left?.kind !== 'observation' || right?.kind !== 'decision' || right?.adopted_later !== true) fail(`${id} preconditions`);
      return { winner: 'none', action: 'supersede_prior_decision_only', may_rewrite_historical_observation: false };
    case 'unresolved_repetition_does_not_promote':
      if (left?.resolution !== 'unresolved' || !Number.isInteger(left?.repeat_count)) fail(`${id} preconditions`);
      return { winner: 'none', action: 'remain_unresolved', promotion_allowed: false };
    case 'automation_prose_is_lead_only':
      if (left?.source_class !== 'automation_completion_prose' || left?.immutable_locator !== false) fail(`${id} preconditions`);
      return { winner: 'none', action: 'record_as_lead_only', promotion_allowed: false };
    case 'semantic_similarity_is_not_identity':
      if (!left?.namespace || !right?.namespace || left.namespace === right.namespace) fail(`${id} preconditions`);
      return { winner: 'none', action: 'reject_collision_candidate', resolution: 'unresolved' };
    case 'reconstructed_historical_identifier_rejected':
      if (left?.created_after_gap_discovery !== true || left?.originating_source !== false) fail(`${id} preconditions`);
      return { winner: 'none', action: 'quarantine_reconstruction', resolution: 'unresolved' };
    case 'immutable_origin_resolves_single_identifier': {
      const fields = ['originating_source', 'immutable_locator', 'namespace_match', 'owner_match', 'semantic_role_match', 'temporal_precedence_match'];
      if (fields.some((field) => left?.[field] !== true)) fail(`${id} provenance agreement incomplete`);
      if (!['M-004', 'M-005', 'M-006'].includes(left.identifier)) fail(`${id} identifier outside quarantined set`);
      return {
        winner: 'left',
        action: `resolve_only_${left.identifier}`,
        other_identifiers_unchanged: ['M-004', 'M-005', 'M-006'].filter((candidate) => candidate !== left.identifier),
      };
    }
    case 'incomplete_history_cannot_prove_unlocated':
      if (left?.history_coverage !== 'partial' || left?.matches_found !== 0) fail(`${id} preconditions`);
      return { winner: 'none', action: 'remain_unresolved', classification: 'absence_unproven' };
    default:
      fail(`unknown case ${id}`);
  }
}

export function validateClaimConflictFixture(fixture) {
  if (fixture?.schema_version !== 1 || fixture?.fixture_id !== 'CM-1029' || fixture?.queue_item !== 'M-RECONCILE-002') fail('fixture identity');
  if (!Array.isArray(fixture.cases) || fixture.cases.length !== 8) fail('expected eight cases');
  const seen = new Set();
  for (const entry of fixture.cases) {
    if (!entry?.case_id || seen.has(entry.case_id)) fail('case ids must be unique');
    seen.add(entry.case_id);
    const actual = JSON.stringify(resolveClaimConflict(entry));
    const expected = JSON.stringify(entry.expected);
    if (actual !== expected) fail(`${entry.case_id} outcome mismatch`);
  }
  for (const id of ['M-004', 'M-005', 'M-006']) {
    if (fixture.application?.[id] !== 'unresolved') fail(`${id} must remain unresolved`);
  }
  return { fixture_id: fixture.fixture_id, verified_cases: fixture.cases.length, application: fixture.application, status: 'verified_fail_closed' };
}
