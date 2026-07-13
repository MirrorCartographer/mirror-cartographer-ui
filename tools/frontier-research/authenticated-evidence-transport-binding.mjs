const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function validateReceipt(receipt, method, commitSha) {
  if (!receipt || typeof receipt !== 'object') return fail('transport_receipt_missing', { method: method.name });
  if (receipt.verified !== true) return fail('transport_receipt_unverified', { method: method.name });
  if (receipt.commit_sha !== commitSha) return fail('transport_receipt_commit_mismatch', { method: method.name });
  if (receipt.page_count !== method.page_count) return fail('transport_page_count_mismatch', { method: method.name });
  if (receipt.record_count !== method.record_count) return fail('transport_record_count_mismatch', { method: method.name });
  if (receipt.raw_output_sha256 !== method.raw_output_sha256) return fail('transport_raw_output_digest_mismatch', { method: method.name });
  if (!SHA256.test(receipt.receipt_sha256 ?? '')) return fail('transport_receipt_digest_invalid', { method: method.name });
  if (!Array.isArray(receipt.pages) || receipt.pages.length !== receipt.page_count) return fail('transport_pages_invalid', { method: method.name });

  const requestIds = new Set();
  for (let index = 0; index < receipt.pages.length; index += 1) {
    const page = receipt.pages[index];
    if (page.page_number !== index + 1) return fail('transport_page_sequence_invalid', { method: method.name, page: index + 1 });
    if (page.status !== 200) return fail('transport_http_status_invalid', { method: method.name, page: index + 1 });
    if (!page.request_id || requestIds.has(page.request_id)) return fail('transport_request_id_invalid', { method: method.name, page: index + 1 });
    requestIds.add(page.request_id);
    if (!SHA256.test(page.body_sha256 ?? '')) return fail('transport_body_digest_invalid', { method: method.name, page: index + 1 });
    if (page.api_version_requested !== page.api_version_selected) return fail('transport_api_version_mismatch', { method: method.name, page: index + 1 });
    if (index < receipt.pages.length - 1 && typeof page.next_url !== 'string') return fail('transport_chain_truncated', { method: method.name, page: index + 1 });
    if (index === receipt.pages.length - 1 && page.next_url !== null) return fail('transport_chain_nonterminal', { method: method.name, page: index + 1 });
  }
  return { verified: true };
}

export function validateAuthenticatedEvidenceTransportBinding(input) {
  if (!input || typeof input !== 'object') return fail('binding_invalid');
  if (!SHA40.test(input.commit_sha ?? '')) return fail('commit_sha_invalid');
  if (!input.primary || !input.independent) return fail('enumeration_methods_missing');
  if (input.primary.commit_sha !== input.commit_sha || input.independent.commit_sha !== input.commit_sha) return fail('enumeration_commit_mismatch');
  if (!SHA256.test(input.primary.raw_output_sha256 ?? '') || !SHA256.test(input.independent.raw_output_sha256 ?? '')) return fail('enumeration_digest_invalid');

  const primary = validateReceipt(input.transport_receipts?.primary, { ...input.primary, name: 'primary' }, input.commit_sha);
  if (!primary.verified) return primary;
  const independent = validateReceipt(input.transport_receipts?.independent, { ...input.independent, name: 'independent' }, input.commit_sha);
  if (!independent.verified) return independent;

  if (input.transport_receipts.primary.receipt_sha256 === input.transport_receipts.independent.receipt_sha256) {
    return fail('transport_receipts_not_independent');
  }

  return {
    verified: true,
    reason: 'authenticated_evidence_transport_binding_valid',
    commit_sha: input.commit_sha,
    primary_receipt_sha256: input.transport_receipts.primary.receipt_sha256,
    independent_receipt_sha256: input.transport_receipts.independent.receipt_sha256,
    claim_boundary: {
      proves_transport_provenance: true,
      proves_semantic_completeness: false,
      proves_deployment_identity: false,
      proves_browser_or_device_behavior: false
    }
  };
}
