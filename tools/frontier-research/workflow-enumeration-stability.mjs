import { createHash } from 'node:crypto';

const TERMINAL_STATUSES = new Set(['completed']);

function assertIso(value, field) {
  const time = Date.parse(value);
  if (!value || Number.isNaN(time)) throw new Error(`${field}_invalid`);
  return time;
}

function canonicalRun(run) {
  if (!run || !Number.isInteger(run.id)) throw new Error('run_id_invalid');
  if (!Number.isInteger(run.run_attempt) || run.run_attempt < 1) throw new Error('run_attempt_invalid');
  if (typeof run.head_sha !== 'string' || !/^[0-9a-f]{40}$/i.test(run.head_sha)) throw new Error('run_head_sha_invalid');
  if (typeof run.event !== 'string' || !run.event) throw new Error('run_event_invalid');
  if (typeof run.status !== 'string' || !run.status) throw new Error('run_status_invalid');
  const updatedAt = assertIso(run.updated_at, 'run_updated_at');
  return {
    id: run.id,
    run_attempt: run.run_attempt,
    head_sha: run.head_sha.toLowerCase(),
    event: run.event,
    status: run.status,
    conclusion: run.conclusion ?? null,
    updated_at: new Date(updatedAt).toISOString()
  };
}

function digestRuns(runs) {
  const canonical = runs.map(canonicalRun).sort((a, b) => a.id - b.id || a.run_attempt - b.run_attempt);
  const ids = new Set();
  for (const run of canonical) {
    const key = `${run.id}:${run.run_attempt}`;
    if (ids.has(key)) throw new Error('duplicate_run_attempt');
    ids.add(key);
  }
  return {
    canonical,
    digest: createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  };
}

export function assessWorkflowEnumerationStability(input) {
  if (!input || input.schema_version !== 1) throw new Error('schema_version_unsupported');
  const commitSha = String(input.commit_sha ?? '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('commit_sha_invalid');
  if (!Array.isArray(input.observations) || input.observations.length < 2) throw new Error('two_observations_required');

  const observations = input.observations.map((observation, index) => {
    const started = assertIso(observation.started_at, `observation_${index}_started_at`);
    const completed = assertIso(observation.completed_at, `observation_${index}_completed_at`);
    if (completed < started) throw new Error(`observation_${index}_time_order_invalid`);
    if (observation.complete !== true) throw new Error(`observation_${index}_not_complete`);
    if (observation.provider_ceiling_ambiguous === true) throw new Error(`observation_${index}_provider_ceiling_ambiguous`);
    const { canonical, digest } = digestRuns(observation.runs ?? []);
    for (const run of canonical) if (run.head_sha !== commitSha) throw new Error(`observation_${index}_cross_commit_run`);
    return { started, completed, canonical, digest };
  });

  for (let index = 1; index < observations.length; index += 1) {
    if (observations[index].started < observations[index - 1].completed) throw new Error('observations_overlap_or_reverse');
  }

  const first = observations[0];
  const last = observations.at(-1);
  const digestsAgree = observations.every((observation) => observation.digest === first.digest);
  const allTerminal = last.canonical.every((run) => TERMINAL_STATUSES.has(run.status));
  const latestRunUpdate = last.canonical.reduce((max, run) => Math.max(max, Date.parse(run.updated_at)), 0);
  const quietPeriodMs = Number(input.minimum_quiet_period_ms ?? 0);
  if (!Number.isFinite(quietPeriodMs) || quietPeriodMs < 0) throw new Error('minimum_quiet_period_ms_invalid');
  const observedQuietPeriodMs = last.completed - latestRunUpdate;
  const quietPeriodSatisfied = last.canonical.length === 0 || observedQuietPeriodMs >= quietPeriodMs;

  const reasons = [];
  if (!digestsAgree) reasons.push('enumeration_changed_between_observations');
  if (!allTerminal) reasons.push('nonterminal_workflow_run_present');
  if (!quietPeriodSatisfied) reasons.push('minimum_quiet_period_not_satisfied');

  return {
    schema_version: 1,
    commit_sha: commitSha,
    stable: reasons.length === 0,
    evidence_strength: reasons.length === 0 ? 'temporally_stabilized_exact_commit_enumeration' : 'temporally_unstable_or_incomplete',
    observation_count: observations.length,
    canonical_digest: digestsAgree ? first.digest : null,
    run_count: last.canonical.length,
    all_terminal: allTerminal,
    minimum_quiet_period_ms: quietPeriodMs,
    observed_quiet_period_ms: last.canonical.length === 0 ? null : observedQuietPeriodMs,
    reasons,
    falsification_route: 'Repeat two or more non-overlapping exhaustive enumerations for the same commit after all runs are terminal and the configured quiet period has elapsed; any digest change falsifies stability.'
  };
}
