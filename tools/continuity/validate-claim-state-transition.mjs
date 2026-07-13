import { createHash } from 'node:crypto';
import { validateCoverageEvent } from './validate-provenance-coverage-event.mjs';

const STATES = new Set(['observed','inferred','proposed','superseded','unresolved','located','unlocated']);
const ALLOWED = new Map([
  ['unresolved', new Set(['observed','inferred','located','unlocated'])],
  ['inferred', new Set(['observed','superseded','unresolved'])],
  ['observed', new Set(['superseded','unresolved'])],
  ['proposed', new Set(['observed','inferred','superseded','unresolved'])],
  ['superseded', new Set(['observed','inferred','unresolved'])],
  ['located', new Set(['unresolved'])],
  ['unlocated', new Set(['located','unresolved'])]
]);

function assert(condition, code) { if (!condition) throw new Error(code); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
function evidenceClasses(refs) { return new Set(refs.map(ref => ref?.class).filter(Boolean)); }

export function computeTransitionDigest(record) {
  return createHash('sha256').update(canonical({
    transition_id: record.transition_id,
    claim_id: record.claim_id,
    prior_state: record.prior_state,
    next_state: record.next_state,
    observed_at: record.observed_at,
    actor: record.actor,
    evidence_refs: record.evidence_refs,
    reason: record.reason,
    privacy_class: record.privacy_class,
    falsification_route: record.falsification_route,
    prior_transition_digest: record.prior_transition_digest ?? null,
    coverage_digest: record.coverage_digest ?? null
  })).digest('hex');
}

export function validateClaimTransition(record, { coverageEvent = null, expectedPriorDigest = null } = {}) {
  assert(record?.schema_version === 1, 'schema-version');
  for (const field of ['transition_id','claim_id','observed_at','actor','reason','privacy_class','falsification_route']) {
    assert(nonEmpty(record[field]), `${field.replaceAll('_','-')}`);
  }
  assert(STATES.has(record.prior_state), 'invalid-prior-state');
  assert(STATES.has(record.next_state), 'invalid-next-state');
  assert(record.prior_state !== record.next_state, 'no-op-transition');
  assert(ALLOWED.get(record.prior_state)?.has(record.next_state), 'illegal-transition');
  assert(Array.isArray(record.evidence_refs) && record.evidence_refs.length > 0, 'evidence-refs-required');
  for (const ref of record.evidence_refs) {
    assert(nonEmpty(ref?.locator), 'evidence-locator');
    assert(nonEmpty(ref?.class), 'evidence-class');
    assert(!('text' in ref), 'private-source-text-forbidden');
  }

  const classes = evidenceClasses(record.evidence_refs);
  if (record.next_state === 'observed') assert(classes.has('direct_inspectable_source') || classes.has('decision_source'), 'observed-requires-direct-source');
  if (record.next_state === 'located' || record.next_state === 'unlocated') {
    assert(coverageEvent, 'coverage-event-required');
    const validated = validateCoverageEvent(coverageEvent);
    assert(record.coverage_digest === validated.coverage_digest, 'coverage-digest-mismatch');
    const resolution = coverageEvent.resolutions.find(item => item.identifier === record.claim_id);
    assert(resolution, 'claim-not-in-coverage-event');
    assert(resolution.status === record.next_state, 'coverage-resolution-mismatch');
  }

  if (expectedPriorDigest !== null) {
    assert(record.prior_transition_digest === expectedPriorDigest, 'prior-transition-digest-mismatch');
  }
  if (record.prior_state === 'located' && record.next_state === 'unresolved') {
    assert(classes.has('source_integrity_failure') || classes.has('namespace_conflict') || classes.has('digest_failure') || classes.has('provenance_invalidation'), 'located-reopen-reason-required');
  }

  const digest = computeTransitionDigest(record);
  assert(record.transition_digest === digest, 'transition-digest-mismatch');
  return Object.freeze({ valid: true, transition_digest: digest, claim_id: record.claim_id, next_state: record.next_state });
}
