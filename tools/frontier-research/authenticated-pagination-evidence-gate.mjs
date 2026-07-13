import { validatePaginationChainIntegrity } from './pagination-chain-integrity.mjs';
import { validateAuthenticatedEvidenceTransportBinding } from './authenticated-evidence-transport-binding.mjs';

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

export function validateAuthenticatedPaginationEvidence(input) {
  if (!input || typeof input !== 'object') return fail('authenticated_pagination_evidence_invalid');

  for (const method of ['primary', 'independent']) {
    const receipt = input.transport_receipts?.[method];
    const chain = validatePaginationChainIntegrity(receipt);
    if (!chain.verified) {
      return fail('pagination_chain_integrity_failed', {
        method,
        chain_reason: chain.reason,
        page: chain.page ?? null,
        next_page: chain.next_page ?? null
      });
    }
  }

  const binding = validateAuthenticatedEvidenceTransportBinding(input);
  if (!binding.verified) return binding;

  return {
    verified: true,
    reason: 'authenticated_pagination_evidence_valid',
    commit_sha: input.commit_sha,
    primary_receipt_sha256: input.transport_receipts.primary.receipt_sha256,
    independent_receipt_sha256: input.transport_receipts.independent.receipt_sha256,
    claim_boundary: {
      proves_page_link_continuity: true,
      proves_transport_provenance: true,
      proves_semantic_completeness: false,
      proves_provider_absence: false,
      proves_deployment_identity: false
    }
  };
}
