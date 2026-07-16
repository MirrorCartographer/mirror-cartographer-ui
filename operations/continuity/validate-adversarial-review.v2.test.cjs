'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v2.cjs');

function phase(checkpoint) {
  return {
    checkpoint,
    claim_or_design_tested: 'candidate recovered knowledge is safe to commit',
    challenge_method: 'disposable semantic counterexample',
    evidence: ['in-memory fixture'],
    failures_or_counterexamples_found: [],
    repairs_made: [],
    remaining_uncertainty: [],
    robustness_increased: true,
    evidence_quality: 'deterministic fixture',
    rollback_route: 'discard fixture',
    next_falsifiable_step: 'run the next negative control',
    evidence_required_before_publication: [],
  };
}

function validRecord() {
  return {
    decision: 'block',
    phases: [
      phase('before_knowledge_commit'),
      phase('post_implementation'),
      phase('verification'),
    ],
  };
}

test('accepts a complete blocked record', () => {
  assert.equal(validateRecord(validRecord()).valid, true);
});

test('rejects unknown decision vocabulary', () => {
  const record = validRecord();
  record.decision = 'blocked';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /decision must be one of/);
});

test('rejects omitted publication evidence inventory', () => {
  const record = validRecord();
  delete record.phases[0].evidence_required_before_publication;
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /missing required field: evidence_required_before_publication/);
});

test('rejects blank evidence items', () => {
  const record = validRecord();
  record.phases[0].evidence = [''];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /evidence\[0\] must be a non-empty string/);
});

test('rejects empty evidence collections', () => {
  const record = validRecord();
  record.phases[0].evidence = [];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /evidence must contain at least one item/);
});

test('rejects publication while evidence requirements remain', () => {
  const record = validRecord();
  record.decision = 'publish';
  record.phases[2].evidence_required_before_publication = ['commit-matched runtime output'];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /retains evidence requirements incompatible/);
});

test('malformed phases fail closed without throwing', () => {
  const record = validRecord();
  record.phases[1] = null;
  assert.doesNotThrow(() => validateRecord(record));
  assert.equal(validateRecord(record).valid, false);
});
