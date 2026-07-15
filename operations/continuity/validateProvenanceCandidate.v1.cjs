'use strict';

const SUBJECTS = new Set(['M-004', 'M-005', 'M-006']);
const ROLES = new Set(['assigning_source', 'downstream_reference', 'generated_mirror', 'search_snippet', 'token_collision', 'unknown']);
const COVERAGE = new Set(['covered', 'partial', 'inaccessible', 'unknown_permission', 'intentionally_excluded', 'ceiling_limited']);
const CLASSIFICATIONS = new Set(['located_verified', 'candidate_unverified', 'downstream_reference_only', 'noncapable_collision', 'coverage_blocked']);
const TEST_STATUSES = new Set(['pass', 'fail', 'unknown', 'not_testable']);
const AGREEMENT_KEYS = ['namespace', 'authority', 'semantic_role', 'temporal_precedence', 'immutable_locator'];
const CLAIM_KEYS = ['observed', 'inferred', 'proposed', 'superseded', 'unresolved'];
const BLOCKED_COVERAGE = new Set(['partial', 'inaccessible', 'unknown_permission', 'intentionally_excluded', 'ceiling_limited']);
const NON_ASSIGNING_ROLES = new Set(['generated_mirror', 'search_snippet', 'token_collision']);

function isStringList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateProvenanceCandidate(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, errors: ['record must be an object'] };

  if (record.schema_version !== 1) errors.push('schema_version must equal 1');
  if (typeof record.record_id !== 'string' || !/^PCA-[A-Za-z0-9._:-]+$/.test(record.record_id)) errors.push('record_id is invalid');
  if (record.queue_item !== 'M-RECONCILE-002') errors.push('queue_item must equal M-RECONCILE-002');
  if (!SUBJECTS.has(record.subject_identifier)) errors.push('subject_identifier is invalid');

  const candidate = record.candidate;
  if (!candidate || typeof candidate !== 'object') {
    errors.push('candidate is required');
  } else {
    if (typeof candidate.source_class !== 'string' || candidate.source_class.length === 0) errors.push('candidate.source_class is required');
    if (typeof candidate.locator !== 'string' || candidate.locator.length === 0) errors.push('candidate.locator is required');
    if (!(candidate.immutable_identity === null || typeof candidate.immutable_identity === 'string')) errors.push('candidate.immutable_identity must be string or null');
    if (!ROLES.has(candidate.observed_role)) errors.push('candidate.observed_role is invalid');
    if (!COVERAGE.has(candidate.coverage_status)) errors.push('candidate.coverage_status is invalid');
  }

  const tests = record.agreement_tests;
  if (!tests || typeof tests !== 'object') {
    errors.push('agreement_tests is required');
  } else {
    for (const key of AGREEMENT_KEYS) {
      const test = tests[key];
      if (!test || typeof test !== 'object') errors.push(`agreement_tests.${key} is required`);
      else {
        if (!TEST_STATUSES.has(test.status)) errors.push(`agreement_tests.${key}.status is invalid`);
        if (!isStringList(test.evidence)) errors.push(`agreement_tests.${key}.evidence must be a string array`);
      }
    }
  }

  if (!CLASSIFICATIONS.has(record.classification)) errors.push('classification is invalid');

  const claims = record.claim_states;
  if (!claims || typeof claims !== 'object') errors.push('claim_states is required');
  else for (const key of CLAIM_KEYS) if (!isStringList(claims[key])) errors.push(`claim_states.${key} must be a string array`);

  if (!record.privacy || record.privacy.contains_private_source_material !== false) errors.push('privacy must fail closed and contain no private source material');
  if (typeof record.falsification_route !== 'string' || record.falsification_route.length === 0) errors.push('falsification_route is required');

  if (candidate && record.classification === 'located_verified') {
    if (candidate.observed_role !== 'assigning_source') errors.push('located_verified requires assigning_source role');
    if (candidate.coverage_status !== 'covered') errors.push('located_verified requires covered status');
    if (typeof candidate.immutable_identity !== 'string' || candidate.immutable_identity.length === 0) errors.push('located_verified requires immutable identity');
    if (tests) for (const key of AGREEMENT_KEYS) if (!tests[key] || tests[key].status !== 'pass') errors.push(`located_verified requires ${key} agreement`);
  }

  if (candidate && BLOCKED_COVERAGE.has(candidate.coverage_status) && record.classification !== 'coverage_blocked') {
    errors.push('incomplete coverage requires coverage_blocked classification');
  }

  if (candidate && NON_ASSIGNING_ROLES.has(candidate.observed_role) && !['downstream_reference_only', 'noncapable_collision'].includes(record.classification)) {
    errors.push('mirror, snippet, or token collision cannot establish provenance');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateProvenanceCandidate };
