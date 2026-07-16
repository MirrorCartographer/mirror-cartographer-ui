'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v2.cjs');

function evidence(claim = 'candidate recovered knowledge is safe to commit') {
  return {
    type: 'deterministic_fixture',
    locator: 'fixture://continuity/adversarial-review-v2',
    observed_at: '2026-07-16T13:00:00Z',
    supported_claim: claim,
    strength: 'strong',
    retention_status: 'retained_copy',
  };
}

function phase(checkpoint) {
  return {
    cycle_id: 'cycle-2026-07-16-01',
    target_id: 'continuity-adversarial-review-v2',
    target_digest_or_commit: 'branch:continuity/adversarial-review-v2',
    checkpoint,
    recorded_at: '2026-07-16T13:00:00Z',
    claim_or_design_tested: 'candidate recovered knowledge is safe to commit',
    challenge_method: 'disposable structural counterexample',
    evidence: [evidence()],
    failures_or_counterexamples_found: [],
    repairs_made: [],
    remaining_uncertainty: [],
    robustness_increased: true,
    evidence_quality: 'deterministic retained fixture',
    rollback_route: 'discard fixture and revert branch commit',
    next_falsifiable_step: 'run the next negative control',
  };
}

function validRecord() {
  return {
    schema_version: 2,
    cycle_id: 'cycle-2026-07-16-01',
    target_id: 'continuity-adversarial-review-v2',
    target_digest_or_commit: 'branch:continuity/adversarial-review-v2',
    started_at: '2026-07-16T12:55:00Z',
    decision: 'block',
    phases: [
      phase('before_knowledge_commit'),
      phase('post_implementation'),
      phase('verification'),
    ],
  };
}

test('accepts a complete identity-bound blocked record', () => {
  assert.equal(validateRecord(validRecord()).valid, true);
});

test('rejects unknown or missing decision vocabulary', () => {
  const unknown = validRecord();
  unknown.decision = 'blocked';
  assert.match(validateRecord(unknown).errors.join('\n'), /decision must be one of/);

  const missing = validRecord();
  delete missing.decision;
  assert.match(validateRecord(missing).errors.join('\n'), /decision must be one of/);
});

test('rejects cycle or target substitution between checkpoints', () => {
  const record = validRecord();
  record.phases[1].target_digest_or_commit = 'commit:substituted';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /must match record target_digest_or_commit/);
});

test('rejects empty or malformed evidence collections', () => {
  const empty = validRecord();
  empty.phases[0].evidence = [];
  assert.match(validateRecord(empty).errors.join('\n'), /must contain at least one retained item/);

  const malformed = validRecord();
  malformed.phases[1].evidence = [{ locator: 'fixture://missing-fields' }];
  const errors = validateRecord(malformed).errors.join('\n');
  assert.match(errors, /missing required field: type/);
  assert.match(errors, /missing required field: supported_claim/);
  assert.match(errors, /missing required field: retention_status/);
});

test('rejects mutable or unsupported evidence retention', () => {
  const record = validRecord();
  record.phases[2].evidence[0].retention_status = 'mutable';
  assert.match(validateRecord(record).errors.join('\n'), /retention_status is unsupported/);
});

test('rejects lead-only evidence for a success decision', () => {
  const record = validRecord();
  record.decision = 'canonicalize';
  record.phases[2].evidence[0].strength = 'lead_only';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /lead_only evidence incompatible/);
});
