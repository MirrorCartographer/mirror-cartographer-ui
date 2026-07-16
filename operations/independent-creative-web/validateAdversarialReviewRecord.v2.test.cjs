'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewRecord } = require('./validateAdversarialReviewRecord.v2.cjs');

function baseRecord() {
  return {
    schema_version: 2,
    checkpoint: 'verification',
    claim_or_design: 'The exact preview artifact is safe to publish.',
    challenge_method: 'Falsify scope isolation and commit-bound evidence.',
    evidence: ['protocol inspected', 'validator source inspected'],
    findings: [],
    repairs: ['Hardened protected-scope normalization and commit binding.'],
    remaining_uncertainty: [],
    rollback_route: 'Revert the validator and test commits on preview.',
    robustness_verdict: 'stronger',
    next_falsifiable_step: 'Execute this suite at the exact artifact commit.',
    publication_decision: 'publish',
    artifact_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    critical_risks_remaining: 0,
    safe_experiments_reversed: true,
    commit_matched_evidence: [{
      commit_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      locator: 'https://example.invalid/immutable-artifact',
      claim: 'Exact artifact passed the publication checks.',
      observed_at: '2026-07-16T07:08:30Z',
    }],
  };
}

test('accepts a complete commit-bound verification record', () => {
  assert.deepEqual(validateAdversarialReviewRecord(baseRecord()), { valid: true, errors: [] });
});

for (const scope of ['production_deployment', 'Live-DNS fixture', 'AUTOMATION/test', 'shared.state', 'credentials sandbox']) {
  test(`rejects protected scope variant: ${scope}`, () => {
    const record = baseRecord();
    record.publication_decision = 'block';
    record.intentional_failure_experiment = {
      scope,
      reversible: true,
      isolated: true,
      restored: true,
    };
    const result = validateAdversarialReviewRecord(record);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.startsWith('forbidden_experiment_scope:')));
  });
}

test('rejects commit evidence for a different artifact', () => {
  const record = baseRecord();
  record.commit_matched_evidence[0].commit_sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  assert.ok(validateAdversarialReviewRecord(record).errors.includes('invalid_or_commit_mismatched_evidence'));
});

test('rejects unstructured evidence strings masquerading as commit proof', () => {
  const record = baseRecord();
  record.commit_matched_evidence = ['passed'];
  assert.ok(validateAdversarialReviewRecord(record).errors.includes('invalid_or_commit_mismatched_evidence'));
});

test('rejects non-string challenge record entries', () => {
  const record = baseRecord();
  record.publication_decision = 'block';
  record.findings = [{ severity: 'critical' }];
  assert.ok(validateAdversarialReviewRecord(record).errors.includes('findings_require_strings'));
});

test('permits an isolated disposable fixture experiment', () => {
  const record = baseRecord();
  record.publication_decision = 'block';
  record.intentional_failure_experiment = {
    scope: 'disposable local fixture',
    reversible: true,
    isolated: true,
    restored: true,
  };
  assert.equal(validateAdversarialReviewRecord(record).valid, true);
});
