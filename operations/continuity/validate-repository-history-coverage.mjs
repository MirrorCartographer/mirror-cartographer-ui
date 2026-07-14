const TARGETS = ['M-004', 'M-005', 'M-006'];
const RESOLUTION_STATES = new Set([
  'located',
  'unlocated_after_exhaustive_coverage',
  'unresolved_incomplete_coverage',
  'collision_rejected',
]);

function fail(message) {
  throw new Error(`CM-1031 validation failed: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
}

function requireTimestamp(value, label) {
  requireString(value, label);
  if (Number.isNaN(Date.parse(value))) fail(`${label} must be an ISO-compatible timestamp`);
}

function validateBranchInventory(envelope) {
  if (envelope?.complete !== true) fail('branch inventory is not complete');
  if (envelope?.pagination_exhausted !== true) fail('branch pagination is not exhausted');
  if (!Array.isArray(envelope.branches) || envelope.branches.length === 0) fail('branch inventory is empty');

  const names = new Set();
  for (const [index, branch] of envelope.branches.entries()) {
    requireString(branch?.branch_name, `branches[${index}].branch_name`);
    requireString(branch?.head_commit_sha, `branches[${index}].head_commit_sha`);
    requireTimestamp(branch?.retrieved_at, `branches[${index}].retrieved_at`);
    requireString(branch?.retrieval_method, `branches[${index}].retrieval_method`);
    if (names.has(branch.branch_name)) fail(`duplicate branch ${branch.branch_name}`);
    names.add(branch.branch_name);
  }
  return names;
}

function validateCommitHistory(envelope, branchNames) {
  if (envelope?.complete !== true) fail('commit history is not complete');
  if (envelope?.provider_boundary != null) fail('provider boundary prevents exhaustive classification');
  if (!Array.isArray(envelope.commits) || envelope.commits.length === 0) fail('commit history is empty');

  const commits = new Map();
  const rootsByBranch = new Set();
  for (const [index, commit] of envelope.commits.entries()) {
    requireString(commit?.branch_name, `commits[${index}].branch_name`);
    requireString(commit?.commit_sha, `commits[${index}].commit_sha`);
    if (!branchNames.has(commit.branch_name)) fail(`commit references unknown branch ${commit.branch_name}`);
    if (!Array.isArray(commit.parent_shas)) fail(`commits[${index}].parent_shas must be an array`);
    for (const parent of commit.parent_shas) requireString(parent, `commits[${index}].parent_shas[]`);
    requireTimestamp(commit?.committed_at, `commits[${index}].committed_at`);
    requireString(commit?.message, `commits[${index}].message`);
    requireTimestamp(commit?.retrieved_at, `commits[${index}].retrieved_at`);

    const existing = commits.get(commit.commit_sha);
    if (existing && JSON.stringify(existing.parent_shas) !== JSON.stringify(commit.parent_shas)) {
      fail(`commit ${commit.commit_sha} has conflicting parent data`);
    }
    commits.set(commit.commit_sha, commit);
    if (commit.parent_shas.length === 0) rootsByBranch.add(commit.branch_name);
  }

  for (const branchName of branchNames) {
    if (!rootsByBranch.has(branchName)) fail(`no reachable root retained for branch ${branchName}`);
  }
  return commits;
}

function validateCandidate(candidate, identifier) {
  if (candidate == null) return null;
  for (const field of ['namespace', 'owner', 'semantic_role', 'temporal_precedence', 'immutable_locator']) {
    if (candidate[field] !== true) return 'collision_rejected';
  }
  requireString(candidate.source_object, `${identifier}.candidate.source_object`);
  return 'located';
}

export function validateRepositoryHistoryCoverage(envelope) {
  if (envelope?.schema_version !== 1) fail('schema version');
  if (envelope?.contract_id !== 'CM-1031') fail('contract identity');
  if (envelope?.queue_item !== 'M-RECONCILE-002') fail('queue identity');
  if (envelope?.repository !== 'MirrorCartographer/mirror-cartographer-ui') fail('repository identity');

  const branches = validateBranchInventory(envelope.branch_inventory);
  const commits = validateCommitHistory(envelope.commit_history, branches);
  if (envelope?.artifact_search?.search_complete !== true) fail('artifact search is incomplete');
  if (!Array.isArray(envelope?.artifact_search?.source_classes_searched)) fail('source classes missing');

  const requiredClasses = ['decision_log', 'language_lexicon', 'project_document', 'chat_history_reference', 'repository_artifact'];
  for (const sourceClass of requiredClasses) {
    if (!envelope.artifact_search.source_classes_searched.includes(sourceClass)) fail(`source class not searched: ${sourceClass}`);
  }

  const resolutions = {};
  for (const identifier of TARGETS) {
    const record = envelope.artifact_search.results?.[identifier];
    if (!record) fail(`missing result for ${identifier}`);
    const candidateState = validateCandidate(record.candidate, identifier);
    const claimed = record.resolution_state;
    if (!RESOLUTION_STATES.has(claimed)) fail(`unknown resolution state for ${identifier}`);

    const expected = candidateState ?? 'unlocated_after_exhaustive_coverage';
    if (claimed !== expected) fail(`${identifier} claims ${claimed}; expected ${expected}`);
    resolutions[identifier] = claimed;
  }

  return {
    contract_id: 'CM-1031',
    status: 'verified_exhaustive_coverage',
    branch_count: branches.size,
    unique_commit_count: commits.size,
    resolutions,
  };
}
