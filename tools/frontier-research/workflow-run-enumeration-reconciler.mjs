function normalizeRun(run) {
  if (!run || !Number.isInteger(run.id) || run.id <= 0) {
    throw new TypeError('every workflow run must have a positive integer id');
  }
  return {
    id: run.id,
    head_sha: run.head_sha ?? null,
    event: run.event ?? null,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    workflow_id: run.workflow_id ?? null,
    run_attempt: run.run_attempt ?? null
  };
}

function indexRuns(runs, commitSha) {
  const index = new Map();
  for (const raw of runs) {
    const run = normalizeRun(raw);
    if (run.head_sha !== commitSha) {
      return { ok: false, reason: 'cross_commit_record', run };
    }
    if (index.has(run.id)) {
      return { ok: false, reason: 'duplicate_run_id', run };
    }
    index.set(run.id, run);
  }
  return { ok: true, index };
}

export function reconcileWorkflowEnumerations({ primary, independent, commitSha }) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) {
    throw new TypeError('a full 40-character commitSha is required');
  }
  for (const [name, result] of [['primary', primary], ['independent', independent]]) {
    if (!result || result.complete !== true) {
      return { verified: false, reason: `${name}_incomplete`, commitSha };
    }
    if (result.commitSha !== commitSha) {
      return { verified: false, reason: `${name}_commit_mismatch`, commitSha };
    }
  }

  const a = indexRuns(primary.runs ?? [], commitSha);
  if (!a.ok) return { verified: false, reason: `primary_${a.reason}`, commitSha, offendingRun: a.run };
  const b = indexRuns(independent.runs ?? [], commitSha);
  if (!b.ok) return { verified: false, reason: `independent_${b.reason}`, commitSha, offendingRun: b.run };

  const onlyPrimary = [...a.index.keys()].filter(id => !b.index.has(id)).sort((x, y) => x - y);
  const onlyIndependent = [...b.index.keys()].filter(id => !a.index.has(id)).sort((x, y) => x - y);
  const fieldMismatches = [];
  for (const [id, left] of a.index) {
    const right = b.index.get(id);
    if (!right) continue;
    for (const field of ['head_sha', 'event', 'status', 'conclusion', 'workflow_id', 'run_attempt']) {
      if (left[field] !== right[field]) fieldMismatches.push({ id, field, primary: left[field], independent: right[field] });
    }
  }

  if (onlyPrimary.length || onlyIndependent.length || fieldMismatches.length) {
    return {
      verified: false,
      reason: 'enumeration_divergence',
      commitSha,
      onlyPrimary,
      onlyIndependent,
      fieldMismatches
    };
  }

  return {
    verified: true,
    reason: 'independent_enumerations_match',
    commitSha,
    runCount: a.index.size,
    runIds: [...a.index.keys()].sort((x, y) => x - y)
  };
}
