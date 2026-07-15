import { createHash } from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const WHOLE_SECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function assertWholeSecondUtc(value, field) {
  if (typeof value !== 'string' || !WHOLE_SECOND_UTC.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`invalid_${field}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalSha256(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function validatePage(page, index, headSha) {
  if (!page || typeof page !== 'object') throw new TypeError(`invalid_page:${index}`);
  if (page.page !== index + 1) throw new Error(`non_contiguous_page:${index + 1}`);
  if (!Number.isInteger(page.status) || page.status !== 200) throw new Error(`non_success_status:${index + 1}`);
  if (!Array.isArray(page.workflowRuns)) throw new TypeError(`invalid_workflow_runs:${index + 1}`);
  if (typeof page.responseDigest !== 'string' || !SHA256.test(page.responseDigest)) throw new TypeError(`invalid_response_digest:${index + 1}`);
  if (page.responseDigest !== canonicalSha256(page.rawResponse)) throw new Error(`response_digest_mismatch:${index + 1}`);
  if (!page.rawResponse || !Array.isArray(page.rawResponse.workflow_runs)) throw new TypeError(`invalid_raw_response:${index + 1}`);
  if (page.rawResponse.workflow_runs.length !== page.workflowRuns.length) throw new Error(`page_count_mismatch:${index + 1}`);
  for (const run of page.workflowRuns) {
    if (!run || !Number.isInteger(run.id)) throw new TypeError(`invalid_run_id:${index + 1}`);
    if (typeof run.head_sha !== 'string' || run.head_sha.toLowerCase() !== headSha) throw new Error(`cross_commit_run:${run?.id ?? 'unknown'}`);
  }
  return page.workflowRuns;
}

export function validateWorkflowRunObservationReceipt(receipt, options = {}) {
  if (!receipt || typeof receipt !== 'object') throw new TypeError('receipt must be an object');
  const ceiling = options.ceiling ?? 1000;
  const perPage = options.perPage ?? 100;
  if (receipt.schemaVersion !== 1) throw new Error('unsupported_schema_version');
  if (typeof receipt.headSha !== 'string' || !SHA40.test(receipt.headSha)) throw new TypeError('invalid_head_sha');
  const headSha = receipt.headSha.toLowerCase();
  assertWholeSecondUtc(receipt.start, 'start');
  assertWholeSecondUtc(receipt.end, 'end');
  assertWholeSecondUtc(receipt.retrievedAt, 'retrieved_at');
  if (Date.parse(receipt.start) > Date.parse(receipt.end)) throw new Error('inverted_window');
  if (!Number.isInteger(receipt.totalCount) || receipt.totalCount < 0) throw new TypeError('invalid_total_count');
  if (!Array.isArray(receipt.pages) || receipt.pages.length === 0) throw new Error('pages_required');
  if (receipt.request?.method !== 'GET') throw new Error('invalid_request_method');
  if (receipt.request?.apiVersion !== '2022-11-28') throw new Error('unexpected_api_version');
  if (receipt.request?.accept !== 'application/vnd.github+json') throw new Error('unexpected_accept_header');
  if (receipt.request?.headSha?.toLowerCase() !== headSha) throw new Error('request_commit_mismatch');
  if (receipt.request?.created !== `${receipt.start}..${receipt.end}`) throw new Error('request_window_mismatch');
  if (receipt.request?.perPage !== perPage) throw new Error('unexpected_per_page');

  const runs = receipt.pages.flatMap((page, index) => validatePage(page, index, headSha));
  const ids = runs.map((run) => run.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate_run_id');
  if (runs.length !== receipt.totalCount) throw new Error('total_count_mismatch');

  const lastPage = receipt.pages.at(-1);
  const linkNextAbsent = lastPage.link?.next == null;
  const expectedPageCount = Math.max(1, Math.ceil(receipt.totalCount / perPage));
  const paginationComplete = receipt.pages.length === expectedPageCount && linkNextAbsent;
  if (!paginationComplete) throw new Error('pagination_incomplete');

  const providerCeilingAmbiguous = receipt.totalCount >= ceiling;
  const canonicalEnvelope = {
    schemaVersion: 1,
    headSha,
    start: receipt.start,
    end: receipt.end,
    retrievedAt: receipt.retrievedAt,
    totalCount: receipt.totalCount,
    request: receipt.request,
    pageDigests: receipt.pages.map((page) => page.responseDigest),
    runIds: [...ids].sort((a, b) => a - b)
  };
  const receiptDigest = canonicalSha256(canonicalEnvelope);
  if (receipt.receiptDigest && receipt.receiptDigest !== receiptDigest) throw new Error('receipt_digest_mismatch');

  return {
    schemaVersion: 1,
    start: receipt.start,
    end: receipt.end,
    headSha,
    totalCount: receipt.totalCount,
    paginationComplete,
    providerCeilingAmbiguous,
    pageCount: receipt.pages.length,
    runIds: ids,
    receiptDigest,
    verified: paginationComplete && !providerCeilingAmbiguous,
    failClosedReasons: providerCeilingAmbiguous ? ['provider_ceiling_ambiguous'] : [],
    claimBoundary: 'verified=true establishes structural integrity, exact-commit consistency, count agreement, retained-page digest agreement, and complete pagination for this observation only; it does not establish credential provenance, transport authenticity, cross-client reconciliation, or deployment identity.'
  };
}
