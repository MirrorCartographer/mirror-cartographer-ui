import { buildGhPaginatedWorkflowEnvelope } from '../frontier-research/gh-workflow-run-envelope.mjs';
import { buildWorkflowEvidenceBundle } from './workflow-evidence-bundle.mjs';

function invalid(reason, commitSha, envelope = null) {
  return {
    schema_version: 1,
    evidence_type: 'vercel_exact_commit_workflow_enumeration_bundle',
    commit_sha: commitSha,
    verified: false,
    evidence_strength: 'rejected',
    reconciliation: { verified: false, reason, commitSha },
    independent_envelope: envelope
  };
}

export function buildWorkflowEvidenceBundleFromGhPages({
  commitSha,
  primary,
  primarySource,
  ghPages,
  ghCommand,
  ghRetrievedAt,
  rateLimitProof,
  generatedAt
}) {
  const envelope = buildGhPaginatedWorkflowEnvelope({
    pages: ghPages,
    commitSha,
    command: ghCommand
  });

  if (envelope.complete !== true) {
    return invalid(`independent_${envelope.reason}`, commitSha, envelope);
  }

  const bundle = buildWorkflowEvidenceBundle({
    commitSha,
    primary,
    independent: envelope,
    primarySource,
    independentSource: {
      method: 'gh_api_paginate',
      retrieved_at: ghRetrievedAt,
      pages_fetched: envelope.pageCount
    },
    rateLimitProof,
    generatedAt,
    providerCeilingAmbiguous: envelope.providerCeilingAmbiguous === true
  });

  return {
    ...bundle,
    independent_envelope: {
      source: envelope.source,
      reason: envelope.reason,
      declared_total: envelope.declaredTotal,
      page_count: envelope.pageCount,
      provider_ceiling_ambiguous: envelope.providerCeilingAmbiguous === true,
      command_contract: {
        paginate: envelope.command.includes('--paginate'),
        slurp: envelope.command.includes('--slurp')
      }
    }
  };
}
