'use strict';

const crypto = require('node:crypto');

const SHA40 = /^[0-9a-f]{40}$/;
const API_VERSION = /^\d{4}-\d{2}-\d{2}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function verifyPaginationProvenance(input) {
  const reasons = [];
  if (!input || typeof input !== 'object') reasons.push('input_not_object');
  const request = input?.request || {};
  const pages = input?.pages;
  if (!SHA40.test(request.head_sha || '')) reasons.push('invalid_head_sha');
  if (request.endpoint !== '/repos/{owner}/{repo}/actions/runs') reasons.push('unexpected_endpoint');
  if (request.per_page !== 100) reasons.push('per_page_must_equal_100');
  if (!API_VERSION.test(request.api_version || '')) reasons.push('invalid_api_version');
  if (!Array.isArray(pages) || pages.length === 0) reasons.push('pages_missing');

  const ids = new Set();
  let total = 0;
  if (Array.isArray(pages)) {
    pages.forEach((page, index) => {
      const expectedPage = index + 1;
      if (page.page !== expectedPage) reasons.push(`non_contiguous_page:${expectedPage}`);
      if (!Array.isArray(page.workflow_runs)) {
        reasons.push(`workflow_runs_missing:${expectedPage}`);
        return;
      }
      if (page.workflow_runs.length > 100) reasons.push(`page_overflow:${expectedPage}`);
      total += page.workflow_runs.length;
      for (const run of page.workflow_runs) {
        if (run.head_sha !== request.head_sha) reasons.push(`cross_commit_run:${run.id}`);
        if (!Number.isSafeInteger(run.id)) reasons.push(`invalid_run_id:${expectedPage}`);
        else if (ids.has(run.id)) reasons.push(`duplicate_run_id:${run.id}`);
        else ids.add(run.id);
      }
      const hasNext = typeof page.next === 'string' && page.next.length > 0;
      if (index < pages.length - 1 && !hasNext) reasons.push(`missing_next_link:${expectedPage}`);
      if (index === pages.length - 1 && hasNext) reasons.push('terminal_page_has_next_link');
      if (page.response_sha256 !== digest(page.workflow_runs)) reasons.push(`page_digest_mismatch:${expectedPage}`);
    });
  }

  if (input?.reported_total_count !== total) reasons.push('reported_total_count_mismatch');
  if (total >= 1000) reasons.push('provider_ceiling_ambiguity');
  if (input?.retrieval_complete !== true) reasons.push('retrieval_not_declared_complete');

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'pagination_provenance_verified',
    verified: reasons.length === 0,
    reasons,
    head_sha: request.head_sha || null,
    page_count: Array.isArray(pages) ? pages.length : 0,
    run_count: total,
    evidence_sha256: digest({ request, pages, reported_total_count: input?.reported_total_count })
  };
}

module.exports = { verifyPaginationProvenance, digest };
