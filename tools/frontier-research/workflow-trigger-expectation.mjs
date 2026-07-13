const SHA40 = /^[0-9a-f]{40}$/;

export const RETAINED_EVIDENCE_PATHS = Object.freeze([
  '.github/workflows/vercel-retained-evidence-contract.yml',
  'tools/vercel-studio/retained-workflow-evidence-cli.mjs',
  'tools/vercel-studio/retained-workflow-evidence-cli.test.mjs',
  'tools/vercel-studio/gh-envelope-bundle-adapter.mjs',
  'tools/vercel-studio/gh-envelope-bundle-adapter.test.mjs',
  'tools/vercel-studio/workflow-evidence-bundle.mjs',
  'tools/vercel-studio/workflow-evidence-bundle.test.mjs'
]);

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function normalizePaths(paths) {
  if (!Array.isArray(paths)) throw new TypeError('changed_paths must be an array');
  const result = [];
  const seen = new Set();
  for (const path of paths) {
    assertString(path, 'changed path');
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
      throw new Error(`unsafe repository path: ${path}`);
    }
    if (!seen.has(path)) {
      seen.add(path);
      result.push(path);
    }
  }
  return result.sort();
}

export function assessRetainedEvidenceTrigger(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  const {
    commit_sha,
    event,
    ref,
    default_branch,
    workflow_present_on_default_branch,
    changed_paths,
    changed_paths_complete
  } = input;

  if (!SHA40.test(commit_sha ?? '')) throw new Error('commit_sha must be 40 lowercase hex characters');
  assertString(event, 'event');
  assertString(ref, 'ref');
  assertString(default_branch, 'default_branch');
  if (typeof workflow_present_on_default_branch !== 'boolean') {
    throw new TypeError('workflow_present_on_default_branch must be boolean');
  }
  if (typeof changed_paths_complete !== 'boolean') {
    throw new TypeError('changed_paths_complete must be boolean');
  }

  const paths = normalizePaths(changed_paths);
  const matched_paths = paths.filter((path) => RETAINED_EVIDENCE_PATHS.includes(path));
  const base = {
    schema_version: 1,
    commit_sha,
    event,
    ref,
    matched_paths,
    evidence_complete: changed_paths_complete
  };

  if (!['push', 'pull_request', 'workflow_dispatch'].includes(event)) {
    return { ...base, classification: 'run_not_expected', reason: 'event_not_configured' };
  }

  if (event === 'workflow_dispatch') {
    if (!workflow_present_on_default_branch) {
      return { ...base, classification: 'run_not_expected', reason: 'workflow_absent_from_default_branch' };
    }
    return { ...base, classification: 'run_expected', reason: 'manual_dispatch_requested' };
  }

  if (!changed_paths_complete) {
    return { ...base, classification: 'expectation_unproven', reason: 'changed_path_coverage_incomplete' };
  }

  if (matched_paths.length === 0) {
    return { ...base, classification: 'run_not_expected', reason: 'path_filter_not_matched' };
  }

  if (event === 'push' && ref !== `refs/heads/${default_branch}`) {
    return {
      ...base,
      classification: 'run_expected',
      reason: 'push_path_filter_matched_on_repository_branch'
    };
  }

  return { ...base, classification: 'run_expected', reason: `${event}_path_filter_matched` };
}

export function classifyObservedRun({ expectation, observed_run_count, enumeration_complete }) {
  if (!expectation || typeof expectation !== 'object') throw new TypeError('expectation must be an object');
  if (!Number.isSafeInteger(observed_run_count) || observed_run_count < 0) {
    throw new TypeError('observed_run_count must be a non-negative safe integer');
  }
  if (typeof enumeration_complete !== 'boolean') throw new TypeError('enumeration_complete must be boolean');

  if (!enumeration_complete) {
    return { status: 'observation_unproven', reason: 'workflow_run_enumeration_incomplete' };
  }
  if (expectation.classification === 'expectation_unproven') {
    return { status: 'observation_unproven', reason: expectation.reason };
  }
  if (expectation.classification === 'run_expected' && observed_run_count === 0) {
    return { status: 'expected_run_absent', reason: 'complete_enumeration_returned_zero_runs' };
  }
  if (expectation.classification === 'run_not_expected' && observed_run_count > 0) {
    return { status: 'unexpected_run_present', reason: 'run_exists_despite_negative_trigger_expectation' };
  }
  return {
    status: 'consistent',
    reason: expectation.classification === 'run_expected' ? 'expected_run_observed' : 'no_run_expected_or_observed'
  };
}
