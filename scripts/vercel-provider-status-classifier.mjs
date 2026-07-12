const RATE_LIMIT_HINTS = [
  'build-rate-limit',
  'rate limit',
  'upgradeToPro=build-rate-limit'
];

function text(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function classifyVercelStatus(status) {
  if (!status || typeof status !== 'object') {
    return {
      classification: 'unobservable',
      deployment_verified: false,
      retry_allowed: false,
      reason: 'missing_status'
    };
  }

  const context = text(status.context);
  const state = text(status.state);
  const targetUrl = text(status.target_url);
  const description = text(status.description);

  if (context !== 'vercel') {
    return {
      classification: 'unrelated_status',
      deployment_verified: false,
      retry_allowed: false,
      reason: 'non_vercel_context'
    };
  }

  const rateLimited = RATE_LIMIT_HINTS.some((hint) =>
    targetUrl.includes(hint.toLowerCase()) || description.includes(hint.toLowerCase())
  );

  if (rateLimited) {
    return {
      classification: 'provider_capacity_blocked',
      deployment_verified: false,
      retry_allowed: false,
      reason: 'vercel_build_rate_limit'
    };
  }

  if (state === 'success') {
    return {
      classification: 'provider_reported_success_unbound',
      deployment_verified: false,
      retry_allowed: false,
      reason: 'immutable_commit_binding_not_proven'
    };
  }

  if (state === 'pending') {
    return {
      classification: 'provider_pending',
      deployment_verified: false,
      retry_allowed: false,
      reason: 'provider_result_not_final'
    };
  }

  if (state === 'failure' || state === 'error') {
    return {
      classification: 'provider_execution_failed',
      deployment_verified: false,
      retry_allowed: true,
      reason: 'non_capacity_provider_failure'
    };
  }

  return {
    classification: 'unknown_vercel_status',
    deployment_verified: false,
    retry_allowed: false,
    reason: 'unsupported_status_shape'
  };
}

export function evaluateDeploymentReadiness(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return {
      ready: false,
      decision: 'hold',
      observations: [classifyVercelStatus(null)]
    };
  }

  const observations = statuses.map(classifyVercelStatus);
  const vercel = observations.filter((entry) => entry.classification !== 'unrelated_status');

  if (vercel.some((entry) => entry.classification === 'provider_capacity_blocked')) {
    return { ready: false, decision: 'hold_for_capacity', observations };
  }

  if (vercel.some((entry) => entry.classification === 'provider_pending')) {
    return { ready: false, decision: 'hold_for_final_status', observations };
  }

  if (vercel.some((entry) => entry.classification === 'provider_execution_failed')) {
    return { ready: false, decision: 'diagnose_before_retry', observations };
  }

  if (vercel.some((entry) => entry.classification === 'provider_reported_success_unbound')) {
    return { ready: false, decision: 'require_immutable_binding', observations };
  }

  return { ready: false, decision: 'hold_unobservable', observations };
}
