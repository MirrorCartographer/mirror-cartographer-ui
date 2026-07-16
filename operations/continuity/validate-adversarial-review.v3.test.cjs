'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v3.cjs');

function phase(checkpoint, challengeOutcome = 'stronger_supporting_evidence') {
  return {
    checkpoint,
    claim_or_design_tested: 'candidate research direction is robust enough to retain',
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
    challenge_outcome: challengeOutcome,
    challenge_outcome_detail: 'the retained fixture directly supports the stated outcome',
  };
}

function validRecord() {
  return {
    decision: 'block',
    strongest_surviving_proposal: 'require explicit, evidence-linked challenge outcomes',
    rejected_alternatives: ['treat a structurally complete phase as a meaningful result'],
    unresolved_risks: ['canonical invocation is not yet proven'],
    next_falsifiable_step: 'execute this suite at the exact commit',
    phases: [
      phase('before_knowledge_commit'),
      phase('post_implementation'),
      phase('verification'),
    ],
  };
}

test('accepts a complete blocked Frontier record', () => {
  assert.equal(validateRecord(validRecord()).valid, true);
});

test('rejects a phase with no recognized challenge outcome', () => {
  const record = validRecord();
  delete record.phases[0].challenge_outcome;
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /challenge_outcome must be one of/);
});

test('rejects a challenge outcome with no explicit rationale', () => {
  const record = validRecord();
  record.phases[0].challenge_outcome_detail = '   ';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /challenge_outcome_detail must be a non-empty string/);
});

test('rejects refined design without a repair', () => {
  const record = validRecord();
  record.phases[1].challenge_outcome = 'refined_design';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /refined_design outcome requires at least one repair/);
});

test('accepts refined design with a retained repair', () => {
  const record = validRecord();
  record.phases[1].challenge_outcome = 'refined_design';
  record.phases[1].repairs_made = ['added an explicit outcome contract'];
  assert.equal(validateRecord(record).valid, true);
});

test('rejects unresolved-question outcome without uncertainty', () => {
  const record = validRecord();
  record.phases[2].challenge_outcome = 'documented_unresolved_question';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /requires remaining uncertainty/);
});

test('rejects a missing run-level conclusion', () => {
  const record = validRecord();
  delete record.strongest_surviving_proposal;
  delete record.rejected_alternatives;
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /strongest_surviving_proposal/);
  assert.match(result.errors.join('\n'), /rejected_alternatives must be an array/);
});

test('rejects publication while unresolved run-level risks remain', () => {
  const record = validRecord();
  record.decision = 'publish';
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unresolved_risks are incompatible with decision publish/);
});
