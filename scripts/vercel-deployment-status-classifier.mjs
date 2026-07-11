const RATE_LIMIT_PATTERNS = [
  /build-rate-limit/i,
  /rate[ -]?limit/i,
  /too many requests/i,
  /upgradeToPro=build-rate-limit/i,
];

export function classifyVercelDeploymentStatus(input = {}) {
  const context = String(input.context ?? '').trim();
  const state = String(input.state ?? 'unknown').trim().toLowerCase();
  const targetUrl = String(input.target_url ?? input.targetUrl ?? '').trim();
  const description = String(input.description ?? '').trim();
  const evidenceText = [context, state, targetUrl, description].join(' ');
  const isVercel = /vercel/i.test(context) || /vercel\.com/i.test(targetUrl);
  const isRateLimited = isVercel && RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(evidenceText));

  if (isRateLimited) {
    return {
      provider: 'Vercel',
      classification: 'transient_provider_rate_limit',
      deploymentVerified: false,
      sourceRegressionProven: false,
      retryable: true,
      safeClaim: 'Deployment was not created because the provider rate-limited the build. Source correctness remains unverified.',
      nextAction: 'Retry after the provider build-rate window clears, then verify served commit identity.',
    };
  }

  if (isVercel && state === 'success') {
    return {
      provider: 'Vercel',
      classification: 'provider_reports_success',
      deploymentVerified: false,
      sourceRegressionProven: false,
      retryable: false,
      safeClaim: 'Vercel reports success, but served commit identity still requires independent verification.',
      nextAction: 'Fetch the deployment and compare its immutable build identity with the expected commit.',
    };
  }

  if (isVercel && ['failure', 'error'].includes(state)) {
    return {
      provider: 'Vercel',
      classification: 'provider_failure_unclassified',
      deploymentVerified: false,
      sourceRegressionProven: false,
      retryable: false,
      safeClaim: 'Vercel reports failure; the status alone does not establish a source regression.',
      nextAction: 'Inspect build logs or deployment diagnostics before assigning cause.',
    };
  }

  return {
    provider: isVercel ? 'Vercel' : 'unknown',
    classification: 'insufficient_status_evidence',
    deploymentVerified: false,
    sourceRegressionProven: false,
    retryable: false,
    safeClaim: 'The status payload is insufficient to verify a deployment or diagnose source behavior.',
    nextAction: 'Collect provider status, deployment identity, and served runtime evidence.',
  };
}
