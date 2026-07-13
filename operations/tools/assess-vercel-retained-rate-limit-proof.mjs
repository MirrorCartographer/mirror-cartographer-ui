import { assessWorkflowRunRateLimitEnvelope } from '../research/github-workflow-run-rate-limit-envelope.mjs';

function fail(reason, extra = {}) {
  return {
    ok: false,
    reason,
    promotion_permitted: false,
    evidence_class: 'rate_limit_proof_rejected',
    ...extra,
  };
}

/**
 * Require independently retained response-header evidence for both exhaustive
 * workflow-run clients before Vercel evidence can be promoted.
 *
 * This gate does not enumerate runs or verify deployment identity. It composes
 * the Frontier rate-limit contract into the Vercel evidence path and fails
 * closed when either client lacks a coherent, terminal, non-rate-limited page
 * sequence.
 */
export function assessVercelRetainedRateLimitProof(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input');
  }

  const primary = assessWorkflowRunRateLimitEnvelope(input.primary, options);
  if (!primary.ok) {
    return fail('primary_rate_limit_proof_failed', {
      failed_client: 'primary',
      upstream: primary,
    });
  }

  const independent = assessWorkflowRunRateLimitEnvelope(input.independent, options);
  if (!independent.ok) {
    return fail('independent_rate_limit_proof_failed', {
      failed_client: 'independent',
      upstream: independent,
    });
  }

  if (primary.resource !== independent.resource) {
    return fail('client_resource_mismatch', {
      primary_resource: primary.resource,
      independent_resource: independent.resource,
    });
  }

  return {
    ok: true,
    reason: 'dual_client_rate_limit_proof_accepted',
    promotion_permitted: true,
    evidence_class: 'dual_client_retained_response_header_contract',
    resource: primary.resource,
    clients: {
      primary: {
        page_count: primary.page_count,
        minimum_remaining: primary.minimum_remaining,
        classification: primary.classification,
      },
      independent: {
        page_count: independent.page_count,
        minimum_remaining: independent.minimum_remaining,
        classification: independent.classification,
      },
    },
    claim_boundary: [
      'Proves only that both retained client page sequences satisfy the shared response-header and terminal-page rate-limit contract.',
      'Does not prove authentication scope, Link-header completeness, provider-ceiling absence, dual-client record agreement, workflow existence, deployment identity, browser behavior, audio audibility, or physical-device observation.',
      'Promotion remains forbidden unless the separate pagination, reconciliation, exact-commit, tamper-evidence, and deployment-identity gates also pass.',
    ],
  };
}
