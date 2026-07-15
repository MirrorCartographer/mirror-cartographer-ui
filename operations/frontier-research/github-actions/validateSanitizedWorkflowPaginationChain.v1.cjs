'use strict';

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function nextUrlFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  for (const part of link.split(',')) {
    const match = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/i);
    if (match && match[2].split(/\s+/).includes('next')) return match[1];
  }
  return null;
}

function validateSanitizedWorkflowPaginationChain(input) {
  const reasons = [];
  const exactCommit = input?.exact_commit;
  const apiVersion = input?.api_version;
  const pages = input?.pages;

  if (!COMMIT_SHA.test(String(exactCommit || ''))) reasons.push('invalid_exact_commit');
  if (!apiVersion || typeof apiVersion !== 'string') reasons.push('missing_api_version');
  if (!Array.isArray(pages) || pages.length === 0) reasons.push('missing_pages');

  const runIds = new Set();
  let expectedRequestUrl = null;
  let totalRecords = 0;

  for (const [index, page] of Array.isArray(pages) ? pages.entries() : []) {
    const evidence = page?.response_evidence;
    const records = page?.records;
    const requestUrl = page?.request_url;

    if (page?.page_index !== index + 1) reasons.push(`page_${index + 1}_index_mismatch`);
    if (!requestUrl || typeof requestUrl !== 'string') reasons.push(`page_${index + 1}_missing_request_url`);
    if (expectedRequestUrl && requestUrl !== expectedRequestUrl) reasons.push(`page_${index + 1}_link_chain_mismatch`);
    if (!evidence?.verified || evidence?.classification !== 'sanitized_github_response_evidence') {
      reasons.push(`page_${index + 1}_unsanitized_or_unverified_response`);
    }
    if (evidence?.request?.api_version !== apiVersion || evidence?.request?.headers?.['X-GitHub-Api-Version'] !== apiVersion) {
      reasons.push(`page_${index + 1}_api_version_mismatch`);
    }
    const status = Number(evidence?.response?.status);
    if (!Number.isInteger(status) || status < 200 || status > 299) reasons.push(`page_${index + 1}_non_success_status`);
    if (!Array.isArray(records)) {
      reasons.push(`page_${index + 1}_records_not_array`);
    } else {
      totalRecords += records.length;
      for (const record of records) {
        const id = record?.id;
        if (id === undefined || id === null) reasons.push(`page_${index + 1}_record_missing_id`);
        else if (runIds.has(String(id))) reasons.push(`duplicate_run_id_${id}`);
        else runIds.add(String(id));
        if (record?.head_sha !== exactCommit) reasons.push(`page_${index + 1}_cross_commit_record`);
      }
    }

    const nextUrl = nextUrlFromLink(evidence?.response?.headers?.Link);
    if (index < pages.length - 1 && !nextUrl) reasons.push(`page_${index + 1}_missing_next_link`);
    if (index === pages.length - 1 && nextUrl) reasons.push('final_page_has_next_link');
    expectedRequestUrl = nextUrl;
  }

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'validated_sanitized_workflow_pagination_chain',
    verified: reasons.length === 0,
    reasons: [...new Set(reasons)],
    exact_commit: exactCommit || null,
    api_version: apiVersion || null,
    page_count: Array.isArray(pages) ? pages.length : 0,
    record_count: totalRecords,
    unique_run_id_count: runIds.size,
    coverage: reasons.length ? 'incomplete_or_invalid' : 'link_chain_complete'
  };
}

module.exports = { nextUrlFromLink, validateSanitizedWorkflowPaginationChain };
