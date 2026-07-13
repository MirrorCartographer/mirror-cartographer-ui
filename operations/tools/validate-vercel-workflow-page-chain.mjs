import { validateWorkflowPaginationUrl } from './validate-workflow-pagination-url.mjs';

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

export function validateVercelWorkflowPageChain({ repository, commit_sha, pages, per_page = 100 }) {
  if (!Array.isArray(pages) || pages.length === 0) return fail('pages_required');

  const seen = new Set();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const expectedPage = index + 1;

    if (!page || page.page !== expectedPage || !Array.isArray(page.workflow_runs)) {
      return fail('invalid_page_envelope', { expected_page: expectedPage });
    }

    for (const run of page.workflow_runs) {
      if (!run || run.head_sha !== commit_sha) {
        return fail('cross_commit_record', { page: expectedPage });
      }
      if (!Number.isInteger(run.id) || seen.has(run.id)) {
        return fail('duplicate_or_invalid_run_id', { page: expectedPage });
      }
      seen.add(run.id);
    }

    const isLast = index === pages.length - 1;
    if (isLast) {
      if (page.next_url !== null) {
        return fail('terminal_page_has_continuation', { page: expectedPage });
      }
    } else {
      const continuation = validateWorkflowPaginationUrl({
        url: page.next_url,
        repository,
        commit_sha,
        expected_page: expectedPage + 1,
        expected_per_page: per_page
      });
      if (!continuation.verified) {
        return fail('invalid_continuation_url', {
          page: expectedPage,
          continuation
        });
      }
    }
  }

  return {
    verified: true,
    reason: 'vercel_workflow_page_chain_verified',
    page_count: pages.length,
    run_count: seen.size
  };
}

export default validateVercelWorkflowPageChain;
