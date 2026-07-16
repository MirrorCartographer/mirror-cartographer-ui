'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v4.cjs');

function phase(checkpoint, index) {
  return {
    checkpoint,
    claim_or_design_tested: 'candidate knowledge is robust enough to retain',
    challenge_method: 'disposable semantic counterexample',
    evidence: [`fixture-${index}`, `counterexample-${index}`],
    failures_or_counterexamples_found: ['unbound outcomes can overstate support'],
    repairs_made: ['bound the outcome to explicit evidence indices'],
    remaining_uncertainty: ['canonical invocation is not yet proven'],
    robustness_increased: true,
    evidence_quality: 'deterministic disposable fixture',
    rollback_route: 'delete the isolated branch',
    next_falsifiable_step: 'execute this suite from the exact branch head',
    evidence_required_before_publication: ['exact-commit runtime output'],
    challenge_outcome: 'refined_design',
    challenge_outcome_detail: 'specific retained fixtures support the refinement',
    challenge_id: `challenge-${index}`,
    outcome_evidence_refs: [0, 1],
  };
}

function validRecord() {
  return {
    decision: 'block',
    strongest_surviving_proposal: 'bind each challenge outcome to unique retained evidence',
    rejected_alternatives: ['trust free-text rationale without evidence references'],
    unresolved_risks: ['canonical invocation is not yet proven'],
    next_falsifiable_step: 'run the suite at the exact branch head',
    phases: [
      phase('before_knowledge_commit', 0),
      phase('post_implementation', 1),
      phase('verification', 2),
    ],
  };
}

test('accepts a blocked record with unique challenge and evidence bindings', () => {
  assert.equal(validateRecord(validRecord()).valid, true);
});

test('rejects duplicate challenge identities', () => {
  const record = validRecord();
  record.phases[1].challenge_id = record.phases[0].challenge_id;
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /challenge_id must be unique/);
});

test('rejects an outcome with no retained evidence reference', () => {
  const record = validRecord();
  record.phases[0].outcome_evidence_refs = [];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /must contain at least one evidence index/);
});

test('rejects an out-of-range evidence reference', () => {
  const record = validRecord();
  record.phases[2].outcome_evidence_refs = [9];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /is out of range/);
});

test('rejects duplicate evidence hidden by case and whitespace', () => {
  const record = validRecord();
  record.phases[1].evidence = ['Same evidence', ' same EVIDENCE '];
  record.phases[1].outcome_evidence_refs = [0];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /duplicates earlier evidence/);
});

test('rejects duplicate evidence references', () => {
  const record = validRecord();
  record.phases[0].outcome_evidence_refs = [0, 0];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /duplicates an earlier reference/);
});

test('rejects a run that considered no alternative', () => {
  const record = validRecord();
  record.rejected_alternatives = [];
  const result = validateRecord(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /rejected_alternatives must contain at least one item/);
});
