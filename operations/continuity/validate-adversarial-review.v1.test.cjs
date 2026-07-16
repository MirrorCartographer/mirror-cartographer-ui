'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v1.cjs');

function phase(checkpoint) {
  return {
    checkpoint,
    claim_or_design_tested: 'candidate recovered knowledge is safe to commit',
    challenge_method: 'disposable structural counterexample',
    evidence: ['in-memory fixture'],
    failures_or_counterexamples_found: [],
    repairs_made: [],
    remaining_uncertainty: [],
    robustness_increased: true,
    evidence_quality: 'deterministic fixture',
    rollback_route: 'discard fixture',
    next_falsifiable_step: 'run the next negative control',
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

test('accepts a complete ordered three-phase blocked record', () => {
  assert.equal(validateRecord(validRecord()).valid, true);
});

test('rejects a missing required field', () => {
  const record = validRecord();
  delete record.phases[1].rollback_route;
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /missing required field: rollback_route/);
});

test('rejects duplicate or reordered checkpoints', () => {
  const record = validRecord();
  record.phases[1].checkpoint = 'before_knowledge_commit';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /checkpoint must be post_implementation/);
  assert.match(result.errors.join('\n'), /checkpoint values must be unique/);
});

test('rejects malformed evidence collections', () => {
  const record = validRecord();
  record.phases[2].evidence = 'tests passed';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /evidence must be an array/);
});

test('rejects success while uncertainty remains', () => {
  const record = validRecord();
  record.decision = 'canonicalize';
  record.phases[2].remaining_uncertainty = ['runtime invocation is unproven'];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /retains uncertainty incompatible/);
});
