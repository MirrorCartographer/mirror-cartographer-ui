const TERMINAL = new Set(['completed']);

function assertIso(value, name) {
  const ms = Date.parse(value);
  if (!value || Number.isNaN(ms)) throw new Error(`${name}_invalid`);
  return ms;
}

function normalize(snapshot, label) {
  if (!snapshot || snapshot.complete !== true) throw new Error(`${label}_incomplete`);
  if (!/^[0-9a-f]{40}$/i.test(snapshot.commit_sha || '')) throw new Error(`${label}_commit_invalid`);
  const retrieved = assertIso(snapshot.retrieved_at, `${label}_retrieved_at`);
  if (!Array.isArray(snapshot.runs)) throw new Error(`${label}_runs_invalid`);
  const seen = new Set();
  const runs = snapshot.runs.map((run) => {
    if (!Number.isInteger(run.id) || run.id <= 0) throw new Error(`${label}_run_id_invalid`);
    if (seen.has(run.id)) throw new Error(`${label}_duplicate_run_id`);
    seen.add(run.id);
    if (run.head_sha !== snapshot.commit_sha) throw new Error(`${label}_cross_commit_run`);
    if (!TERMINAL.has(run.status)) throw new Error(`${label}_nonterminal_run`);
    return { id: run.id, status: run.status, conclusion: run.conclusion ?? null, event: run.event ?? null };
  }).sort((a, b) => a.id - b.id);
  return { commit_sha: snapshot.commit_sha, retrieved, runs };
}

export function assessWorkflowStabilization({ first, second, minimum_quiet_ms = 60000 }) {
  if (!Number.isInteger(minimum_quiet_ms) || minimum_quiet_ms < 0) throw new Error('minimum_quiet_ms_invalid');
  const a = normalize(first, 'first');
  const b = normalize(second, 'second');
  if (a.commit_sha !== b.commit_sha) throw new Error('commit_mismatch');
  const quiet_ms = b.retrieved - a.retrieved;
  if (quiet_ms < minimum_quiet_ms) throw new Error('quiet_period_insufficient');
  if (JSON.stringify(a.runs) !== JSON.stringify(b.runs)) throw new Error('workflow_set_not_stable');
  return {
    verified: true,
    commit_sha: a.commit_sha,
    quiet_ms,
    run_count: a.runs.length,
    run_ids: a.runs.map((run) => run.id),
    mutation_performed: false
  };
}
