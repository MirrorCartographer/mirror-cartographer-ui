'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialPhaseRecord } = require('./validateAdversarialPhaseRecord.v4.cjs');

function record(overrides = {}) {
  return {
    schema_version: 4,
    checkpoint: 'verification',
    target: 'M-RECONCILE-002 provenance review',
    attacks: ['weak evidence', 'namespace collision'],
    findings: ['prose-only evidence is not inspectable'],
    repairs: ['required structured immutable or retained evidence'],
    remaining_uncertainty: ['repository coverage remains bounded'],
    rollback_route: 'revert the v4 validator and test commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'verification evidence now has inspectable provenance',
    evidence_quality: 'bounded immutable repository evidence',
    claim_boundary: 'validates record evidence structure, not historical provenance',
    next_falsifiable_step: 'execute this test suite and inventory v3 consumers',
    coverage_class: 'bounded',
    evidence_inspected: [{
      type: 'commit',
      locator: 'github:MirrorCartographer/mirror-cartographer-ui@ae55c7f3ea7a2d5f6e1f13df6befd2a95430ffb4',
      claim_supported: 'v4 validator source exists on preview',
      observed_at: '2026-07-16T08:01:18Z',
      strength: 'immutable_repository_object',
      immutable: true,
      commit_sha: 'ae55c7f3ea7a2d5f6e1f13df6befd2a95430ffb4'
    }],
    negative_controls: ['prose-only evidence', 'mutable unretained URL'],
    ...overrides
  };
}

test('accepts inspectable bounded evidence', () => {
  assert.deepEqual(validateAdversarialPhaseRecord(record()), { valid: true, violations: [] });
});

test('rejects prose-only verification evidence', () => {
  const result = validateAdversarialPhaseRecord(record({ evidence_inspected: ['tests passed'] }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('evidence_0_evidence_item_must_be_object'));
});

test('rejects mutable evidence without retained copy', () => {
  const evidence = { ...record().evidence_inspected[0], immutable: false, retained_copy: false };
  const result = validateAdversarialPhaseRecord(record({ evidence_inspected: [evidence] }));
  assert.ok(result.violations.includes('evidence_0_evidence_must_be_immutable_or_retained'));
});

test('rejects commit evidence with malformed commit identity', () => {
  const evidence = { ...record().evidence_inspected[0], commit_sha: 'main' };
  const result = validateAdversarialPhaseRecord(record({ evidence_inspected: [evidence] }));
  assert.ok(result.violations.includes('evidence_0_invalid_evidence_commit'));
  assert.ok(result.violations.includes('evidence_0_commit_evidence_requires_commit_sha'));
});

test('rejects verified status supported by lead-only evidence', () => {
  const evidence = { ...record().evidence_inspected[0], strength: 'lead_only' };
  const result = validateAdversarialPhaseRecord(record({
    claim_status_after_review: 'verified', coverage_class: 'exhaustive', remaining_uncertainty: [], evidence_inspected: [evidence]
  }));
  assert.ok(result.violations.includes('verified_cannot_rely_on_lead_only_evidence'));
});
