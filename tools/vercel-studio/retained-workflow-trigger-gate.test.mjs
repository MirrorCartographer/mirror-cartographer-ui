import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRetainedWorkflowTriggerGate } from './retained-workflow-trigger-gate.mjs';

const SHA = 'f61bb515c59dd6e77ec9eded1b2be8c8a38e6163';
const baseTrigger = {
  commit_sha: SHA,
  event: 'push',
  ref: 'refs/heads/main',
  default_branch: 'main',
  workflow_present_on_default_branch: true,
  changed_paths: ['.github/workflows/vercel-retained-evidence-contract.yml'],
  changed_paths_complete: true
};

test('accepts only a completely enumerated expected exact-commit run', () => {
  const result = evaluateRetainedWorkflowTriggerGate({
    trigger: baseTrigger,
    observed_runs: [{ id: 101, head_sha: SHA }],
    enumeration_complete: true
  });
  assert.equal(result.eligible_for_retained_evidence_assessment, true);
  assert.equal(result.reason, 'expected_exact_commit_run_observed');
});

test('fails closed when a run was expected but none was observed', () => {
  const result = evaluateRetainedWorkflowTriggerGate({
    trigger: baseTrigger,
    observed_runs: [],
    enumeration_complete: true
  });
  assert.equal(result.eligible_for_retained_evidence_assessment, false);
  assert.equal(result.observation.status, 'expected_run_absent');
});

test('fails closed when enumeration coverage is incomplete', () => {
  const result = evaluateRetainedWorkflowTriggerGate({
    trigger: baseTrigger,
    observed_runs: [{ id: 101, head_sha: SHA }],
    enumeration_complete: false
  });
  assert.equal(result.eligible_for_retained_evidence_assessment, false);
  assert.equal(result.observation.status, 'observation_unproven');
});

test('rejects a cross-commit run', () => {
  assert.throws(() => evaluateRetainedWorkflowTriggerGate({
    trigger: baseTrigger,
    observed_runs: [{ id: 101, head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
    enumeration_complete: true
  }), /cross-commit workflow run rejected/);
});

test('rejects duplicate workflow run identifiers', () => {
  assert.throws(() => evaluateRetainedWorkflowTriggerGate({
    trigger: baseTrigger,
    observed_runs: [{ id: 101, head_sha: SHA }, { id: 101, head_sha: SHA }],
    enumeration_complete: true
  }), /duplicate workflow run id rejected/);
});
