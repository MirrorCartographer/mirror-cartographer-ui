import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRetainedEvidenceTrigger,
  classifyObservedRun
} from './workflow-trigger-expectation.mjs';

const sha = 'a'.repeat(40);
const base = {
  commit_sha: sha,
  event: 'push',
  ref: 'refs/heads/main',
  default_branch: 'main',
  workflow_present_on_default_branch: true,
  changed_paths: ['.github/workflows/vercel-retained-evidence-contract.yml'],
  changed_paths_complete: true
};

test('expects a run when a configured push path matches', () => {
  const result = assessRetainedEvidenceTrigger(base);
  assert.equal(result.classification, 'run_expected');
  assert.deepEqual(result.matched_paths, ['.github/workflows/vercel-retained-evidence-contract.yml']);
});

test('does not expect a run when complete path evidence does not match', () => {
  const result = assessRetainedEvidenceTrigger({ ...base, changed_paths: ['operations/README.md'] });
  assert.equal(result.classification, 'run_not_expected');
  assert.equal(result.reason, 'path_filter_not_matched');
});

test('fails closed when changed path coverage is incomplete', () => {
  const result = assessRetainedEvidenceTrigger({ ...base, changed_paths: [], changed_paths_complete: false });
  assert.equal(result.classification, 'expectation_unproven');
});

test('manual dispatch requires the workflow on the default branch', () => {
  const absent = assessRetainedEvidenceTrigger({
    ...base,
    event: 'workflow_dispatch',
    changed_paths: [],
    workflow_present_on_default_branch: false
  });
  assert.equal(absent.classification, 'run_not_expected');
  assert.equal(absent.reason, 'workflow_absent_from_default_branch');
});

test('complete zero-run enumeration becomes expected_run_absent only when a run was expected', () => {
  const expectation = assessRetainedEvidenceTrigger(base);
  assert.deepEqual(classifyObservedRun({ expectation, observed_run_count: 0, enumeration_complete: true }), {
    status: 'expected_run_absent',
    reason: 'complete_enumeration_returned_zero_runs'
  });
});

test('zero results from incomplete enumeration never prove absence', () => {
  const expectation = assessRetainedEvidenceTrigger(base);
  assert.equal(classifyObservedRun({ expectation, observed_run_count: 0, enumeration_complete: false }).status, 'observation_unproven');
});

test('rejects traversal and ambiguous repository paths', () => {
  assert.throws(() => assessRetainedEvidenceTrigger({ ...base, changed_paths: ['../workflow.yml'] }), /unsafe repository path/);
});
