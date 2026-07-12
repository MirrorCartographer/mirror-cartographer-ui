const SHA_RE = /^[0-9a-f]{40}$/;

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function assessVercelCommitStatus(input = {}) {
  const repository = clean(input.repository);
  const commitSha = clean(input.commit_sha)?.toLowerCase() ?? null;
  const observedAt = clean(input.observed_at);
  const statuses = input.statuses;

  if (!repository || !repository.includes('/')) return { accepted: false, decision: 'invalid_repository' };
  if (!commitSha || !SHA_RE.test(commitSha)) return { accepted: false, decision: 'invalid_commit_sha' };
  if (!observedAt || !Number.isFinite(Date.parse(observedAt))) return { accepted: false, decision: 'invalid_observation_time' };
  if (!Array.isArray(statuses)) return { accepted: false, decision: 'invalid_status_collection' };

  const normalized = statuses.map((status) => ({
    context: clean(status?.context),
    state: clean(status?.state)?.toLowerCase() ?? null,
    target_url: clean(status?.target_url)
  }));

  if (normalized.some((status) => !status.context || !status.state)) {
    return { accepted: false, decision: 'malformed_status' };
  }

  const vercel = normalized.filter((status) => status.context.toLowerCase() === 'vercel');
  if (!vercel.length) {
    return {
      accepted: true,
      deployable: false,
      decision: 'vercel_status_absent',
      reason: 'No Vercel commit status was observed; deployment state remains unproven.',
      repository,
      commit_sha: commitSha,
      observed_at: new Date(observedAt).toISOString(),
      statuses: normalized
    };
  }

  const rateLimited = vercel.find((status) =>
    status.state === 'failure' && /build-rate-limit|upgradeToPro=build-rate-limit/i.test(status.target_url ?? '')
  );
  if (rateLimited) {
    return {
      accepted: true,
      deployable: false,
      decision: 'provider_build_rate_limited',
      reason: 'The exact commit has a failing Vercel status whose target identifies the provider build-rate limit.',
      repository,
      commit_sha: commitSha,
      observed_at: new Date(observedAt).toISOString(),
      vercel_status: rateLimited,
      statuses: normalized
    };
  }

  const successful = vercel.find((status) => status.state === 'success');
  if (successful) {
    return {
      accepted: true,
      deployable: true,
      decision: 'vercel_status_success_observed',
      reason: 'A successful Vercel commit status was observed; immutable deployment identity still requires separate verification.',
      repository,
      commit_sha: commitSha,
      observed_at: new Date(observedAt).toISOString(),
      vercel_status: successful,
      statuses: normalized
    };
  }

  return {
    accepted: true,
    deployable: false,
    decision: 'vercel_status_non_success',
    reason: 'A Vercel status was observed but it does not establish a successful deployment.',
    repository,
    commit_sha: commitSha,
    observed_at: new Date(observedAt).toISOString(),
    statuses: normalized
  };
}
