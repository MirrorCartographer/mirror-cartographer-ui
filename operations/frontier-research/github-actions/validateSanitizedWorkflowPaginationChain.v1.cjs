'use strict';

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function splitLinkValues(link) {
  const values = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;
  let escaped = false;
  for (const char of link) {
    if (escaped) { current += char; escaped = false; continue; }
    if (inQuote && char === '\\') { current += char; escaped = true; continue; }
    if (char === '"' && !inAngle) inQuote = !inQuote;
    else if (char === '<' && !inQuote) { if (inAngle) return { values: [], malformed: true }; inAngle = true; }
    else if (char === '>' && !inQuote) { if (!inAngle) return { values: [], malformed: true }; inAngle = false; }
    if (char === ',' && !inAngle && !inQuote) { if (!current.trim()) return { values: [], malformed: true }; values.push(current.trim()); current = ''; }
    else current += char;
  }
  if (inAngle || inQuote || escaped || !current.trim()) return { values: [], malformed: true };
  values.push(current.trim());
  return { values, malformed: false };
}

function analyzeLinkHeader(link) {
  if (link === undefined || link === null || link === '') return { next_url: null, malformed: false };
  if (typeof link !== 'string') return { next_url: null, malformed: true };
  const split = splitLinkValues(link);
  if (split.malformed) return { next_url: null, malformed: true };
  let nextUrl = null;
  for (const value of split.values) {
    const target = value.match(/^<([^>]*)>([\s\S]*)$/);
    if (!target || !target[1]) return { next_url: null, malformed: true };
    const params = target[2];
    const relations = [];
    const paramPattern = /;\s*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;\s]+))/g;
    let cursor = 0;
    let match;
    while ((match = paramPattern.exec(params)) !== null) {
      if (params.slice(cursor, match.index).trim()) return { next_url: null, malformed: true };
      cursor = paramPattern.lastIndex;
      if (match[1].toLowerCase() === 'rel') {
        const valueText = match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : match[3];
        relations.push(...valueText.toLowerCase().split(/\s+/).filter(Boolean));
      }
    }
    if (params.slice(cursor).trim()) return { next_url: null, malformed: true };
    if (relations.includes('next')) {
      if (nextUrl !== null && nextUrl !== target[1]) return { next_url: null, malformed: true };
      nextUrl = target[1];
    }
  }
  return { next_url: nextUrl, malformed: false };
}

function nextUrlFromLink(link) {
  const analysis = analyzeLinkHeader(link);
  return analysis.malformed ? null : analysis.next_url;
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
    if (!evidence?.verified || evidence?.classification !== 'sanitized_github_response_evidence') reasons.push(`page_${index + 1}_unsanitized_or_unverified_response`);
    if (evidence?.request?.api_version !== apiVersion || evidence?.request?.headers?.['X-GitHub-Api-Version'] !== apiVersion) reasons.push(`page_${index + 1}_api_version_mismatch`);
    const status = Number(evidence?.response?.status);
    if (!Number.isInteger(status) || status < 200 || status > 299) reasons.push(`page_${index + 1}_non_success_status`);
    if (!Array.isArray(records)) reasons.push(`page_${index + 1}_records_not_array`);
    else {
      totalRecords += records.length;
      for (const record of records) {
        const id = record?.id;
        if (id === undefined || id === null) reasons.push(`page_${index + 1}_record_missing_id`);
        else if (runIds.has(String(id))) reasons.push(`duplicate_run_id_${id}`);
        else runIds.add(String(id));
        if (record?.head_sha !== exactCommit) reasons.push(`page_${index + 1}_cross_commit_record`);
      }
    }
    const linkAnalysis = analyzeLinkHeader(evidence?.response?.headers?.Link);
    if (linkAnalysis.malformed) reasons.push(`page_${index + 1}_malformed_link_header`);
    const nextUrl = linkAnalysis.next_url;
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

module.exports = { analyzeLinkHeader, nextUrlFromLink, splitLinkValues, validateSanitizedWorkflowPaginationChain };
