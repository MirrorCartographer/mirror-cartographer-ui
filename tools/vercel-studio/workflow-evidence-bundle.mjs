import { createHash } from 'node:crypto';
import { reconcileWorkflowEnumerations } from '../frontier-research/workflow-run-enumeration-reconciler.mjs';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function sanitizedSource(source, expectedMethod) {
  if (!source || source.method !== expectedMethod) throw new TypeError(`${expectedMethod}_source_required`);
  if (typeof source.retrieved_at !== 'string' || Number.isNaN(Date.parse(source.retrieved_at))) throw new TypeError(`${expectedMethod}_retrieved_at_invalid`);
  if (!Number.isInteger(source.pages_fetched) || source.pages_fetched <= 0) throw new TypeError(`${expectedMethod}_pages_fetched_invalid`);
  return { method: source.method, retrieved_at: source.retrieved_at, pages_fetched: source.pages_fetched };
}

function sanitizedRateLimitProof(proof, sources) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) throw new TypeError('dual_client_rate_limit_proof_required');
  if (proof.ok !== true || proof.promotion_permitted !== true) throw new TypeError('dual_client_rate_limit_proof_not_accepted');
  if (proof.evidence_class !== 'dual_client_retained_response_header_contract') throw new TypeError('dual_client_rate_limit_proof_class_invalid');
  if (!proof.clients?.primary || !proof.clients?.independent) throw new TypeError('dual_client_rate_limit_clients_required');
  for (const client of ['primary', 'independent']) {
    const pageCount = proof.clients[client].page_count;
    const minimumRemaining = proof.clients[client].minimum_remaining;
    if (!Number.isInteger(pageCount) || pageCount <= 0) throw new TypeError(`${client}_rate_limit_page_count_invalid`);
    if (!Number.isInteger(minimumRemaining) || minimumRemaining < 0) throw new TypeError(`${client}_rate_limit_remaining_invalid`);
  }
  if (proof.clients.primary.page_count !== sources.primary.pages_fetched) throw new TypeError('primary_rate_limit_page_count_mismatch');
  if (proof.clients.independent.page_count !== sources.independent.pages_fetched) throw new TypeError('independent_rate_limit_page_count_mismatch');
  if (typeof proof.resource !== 'string' || proof.resource.length === 0) throw new TypeError('dual_client_rate_limit_resource_invalid');
  return {
    evidence_class: proof.evidence_class,
    resource: proof.resource,
    clients: {
      primary: {
        page_count: proof.clients.primary.page_count,
        minimum_remaining: proof.clients.primary.minimum_remaining,
        classification: proof.clients.primary.classification ?? null
      },
      independent: {
        page_count: proof.clients.independent.page_count,
        minimum_remaining: proof.clients.independent.minimum_remaining,
        classification: proof.clients.independent.classification ?? null
      }
    }
  };
}

export function buildWorkflowEvidenceBundle({ commitSha, primary, independent, primarySource, independentSource, rateLimitProof, generatedAt, providerCeilingAmbiguous = false }) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) throw new TypeError('invalid_commit_sha');
  if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) throw new TypeError('generated_at_invalid');
  const sources = {
    primary: sanitizedSource(primarySource, 'repository_api_link_pagination'),
    independent: sanitizedSource(independentSource, 'gh_api_paginate')
  };
  if (Date.parse(generatedAt) < Date.parse(sources.primary.retrieved_at) || Date.parse(generatedAt) < Date.parse(sources.independent.retrieved_at)) {
    throw new TypeError('generated_at_precedes_source_retrieval');
  }
  const acceptedRateLimitProof = sanitizedRateLimitProof(rateLimitProof, sources);
  const reconciliation = providerCeilingAmbiguous
    ? { verified: false, reason: 'provider_ceiling_ambiguous', commitSha }
    : reconcileWorkflowEnumerations({ primary, independent, commitSha });
  return {
    schema_version: 2,
    evidence_type: 'vercel_exact_commit_workflow_enumeration_bundle',
    commit_sha: commitSha,
    generated_at: generatedAt,
    verified: reconciliation.verified === true,
    evidence_strength: reconciliation.verified === true ? 'strong' : 'rejected',
    sources,
    rate_limit_proof: acceptedRateLimitProof,
    raw_enumeration_digests: { primary_sha256: digest(primary), independent_sha256: digest(independent) },
    rate_limit_proof_sha256: digest(acceptedRateLimitProof),
    reconciliation,
    retention_contract: {
      retain_raw_primary: true,
      retain_raw_independent: true,
      retain_raw_response_headers: true,
      retain_rate_limit_proof: true,
      retain_bundle: true,
      secrets_forbidden: true,
      minimum_fields: ['commit_sha', 'source_method', 'retrieved_at', 'pages_fetched', 'sha256', 'rate_limit_proof_sha256']
    }
  };
}
