import { assessWorkflowRunQueryContract } from '../research/github-workflow-run-query-contract.mjs';
import { buildGhPaginatedWorkflowEnvelope } from '../../tools/frontier-research/gh-workflow-run-envelope.mjs';

function fail(reason, extra = {}) {
  return {
    complete: false,
    reason,
    evidence_class: 'non_promotable',
    ...extra,
  };
}

/**
 * Compose the current-source query contract with the independent gh pagination
 * envelope. The query contract must pass before page contents are interpreted.
 */
export function buildVercelWorkflowEvidenceEnvelope(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input');
  }

  const { query_contract: queryContract, pages, commit_sha: commitSha, command } = input;
  const contract = assessWorkflowRunQueryContract(queryContract, options);

  if (!contract.ok) {
    return fail('query_contract_rejected', {
      contract,
      claim_boundary: [
        'No workflow-run coverage claim is permitted.',
        'No deployment or runtime claim is permitted.',
      ],
    });
  }

  if (queryContract.head_sha !== commitSha) {
    return fail('query_commit_mismatch', { contract, commitSha });
  }

  if (queryContract.command !== command) {
    return fail('retained_command_mismatch', { contract, commitSha });
  }

  let envelope;
  try {
    envelope = buildGhPaginatedWorkflowEnvelope({ pages, commitSha, command });
  } catch (error) {
    return fail('pagination_envelope_exception', {
      contract,
      commitSha,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  if (!envelope.complete) {
    return fail('pagination_envelope_rejected', {
      contract,
      commitSha,
      envelope,
    });
  }

  return {
    complete: true,
    reason: 'query_contract_and_pagination_complete',
    evidence_class: 'independent_workflow_run_enumeration',
    commitSha,
    query_contract: contract,
    pagination_envelope: envelope,
    claim_boundary: [
      'Proves only that the retained query intent was current and exhaustive and that retained pages were internally complete under the envelope contract.',
      'Does not prove authentication identity, independent-enumerator agreement, deployment identity, browser runtime behavior, physical-device audibility, or human observation.',
    ],
  };
}
