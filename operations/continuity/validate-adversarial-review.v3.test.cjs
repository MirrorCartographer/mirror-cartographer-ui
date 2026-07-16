'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRecord } = require('./validate-adversarial-review.v3.cjs');

const SHA = '0123456789abcdef0123456789abcdef01234567';

function evidence(claim, commitSha) {
  const item = {
    type: 'deterministic_fixture',
    locator: 'fixture://continuity/adversarial-review-v3',
    observed_at: '2026-07-16T13:00:00Z',
    supported_claim: claim,
    strength: 'strong',
    retention_status: 'retained_copy',
  };
  if (commitSha) item.commit_sha = commitSha;
  return item;
}

function phase(checkpoint, commitSha) {
  const claim = 'candidate recovered knowledge is safe to commit';
  return {
    cycle_id: 'cycle-2026-07-16-02',
    target_id: 'continuity-adversarial-review-v3',
    target_digest_or_commit: `commit:${SHA}`,
    checkpoint,
    recorded_at: '2026-07-16T13:00:00Z',
    claim_or_design_tested: claim,
    challenge_method: 'disposable commit-binding counterexample',
    evidence: [evidence(claim, commitSha)],
    failures_or_counterexamples_found: [],
    repairs_made: [],
    remaining_uncertainty: [],
    robustness_increased: true,
    evidence_quality: 'deterministic retained fixture',
    rollback_route: 'discard fixture and revert branch commit',
    next_falsifiable_step: 'run the next negative control',
  };
}

function record(decision = 'canonicalize') {
  return {
    schema_version: 2,
    cycle_id: 'cycle-2026-07-16-02',
    target_id: 'continuity-adversarial-review-v3',
    target_digest_or_commit: `commit:${SHA}`,
    started_at: '2026-07-16T12:55:00Z',
    decision,
    phases: [
      phase('before_knowledge_commit'),
      phase('post_implementation', SHA),
      phase('verification', SHA),
    ],
  };
}

test('accepts success with exact commit-bound implementation and verification evidence', () => {
  assert.equal(validateRecord(record()).valid, true);
});

test('rejects branch labels as success targets', () => {
  const candidate = record();
  candidate.target_digest_or_commit = 'branch:preview';
  for (const phaseItem of candidate.phases) {
    phaseItem.target_digest_or_commit = 'branch:preview';
  }
  assert.match(validateRecord(candidate).errors.join('\n'), /requires target_digest_or_commit/);
});

test('rejects missing post-implementation commit evidence', () => {
  const candidate = record();
  delete candidate.phases[1].evidence[0].commit_sha;
  assert.match(validateRecord(candidate).errors.join('\n'), /phase 1 requires retained evidence/);
});

test('rejects commit-mismatched verification evidence', () => {
  const candidate = record();
  candidate.phases[2].evidence[0].commit_sha = 'ffffffffffffffffffffffffffffffffffffffff';
  assert.match(validateRecord(candidate).errors.join('\n'), /phase 2 requires retained evidence/);
});

test('preserves blocked branch-scoped research records', () => {
  const candidate = record('block');
  candidate.target_digest_or_commit = 'branch:preview';
  for (const phaseItem of candidate.phases) {
    phaseItem.target_digest_or_commit = 'branch:preview';
  }
  assert.equal(validateRecord(candidate).valid, true);
});
