import {
  assessRetainedEvidenceTrigger,
  classifyObservedRun
} from '../frontier-research/workflow-trigger-expectation.mjs';

const SHA40 = /^[0-9a-f]{40}$/;

function assertRun(run, commitSha) {
  if (!run || typeof run !== 'object') throw new TypeError('each observed run must be an object');
  if (!Number.isSafeInteger(run.id) || run.id <= 0) throw new TypeError('run.id must be a positive safe integer');
  if (!SHA40.test(run.head_sha ?? '')) throw new Error('run.head_sha must be 40 lowercase hex characters');
  if (run.head_sha !== commitSha) throw new Error(`cross-commit workflow run rejected: ${run.id}`);
}

export function evaluateRetainedWorkflowTriggerGate(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  const { trigger, observed_runs, enumeration_complete } = input;
  if (!Array.isArray(observed_runs)) throw new TypeError('observed_runs must be an array');

  const expectation = assessRetainedEvidenceTrigger(trigger);
  const seen = new Set();
  for (const run of observed_runs) {
    assertRun(run, trigger.commit_sha);
    if (seen.has(run.id)) throw new Error(`duplicate workflow run id rejected: ${run.id}`);
    seen.add(run.id);
  }

  const observation = classifyObservedRun({
    expectation,
    observed_run_count: observed_runs.length,
    enumeration_complete
  });

  const eligible =
    expectation.classification === 'run_expected' &&
    observation.status === 'consistent' &&
    observed_runs.length > 0;

  return {
    schema_version: 1,
    commit_sha: trigger.commit_sha,
    expectation,
    observation,
    observed_run_ids: [...seen].sort((a, b) => a - b),
    eligible_for_retained_evidence_assessment: eligible,
    reason: eligible ? 'expected_exact_commit_run_observed' : observation.reason
  };
}
