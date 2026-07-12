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
  return { method: source.method, retrieved_at: source.retrieved_at, pages_fetched: source.pages_fetched ?? null };
}

export function buildWorkflowEvidenceBundle({ commitSha, primary, independent, primarySource, independentSource, generatedAt, providerCeilingAmbiguous = false }) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) throw new TypeError('invalid_commit_sha');
  if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) throw new TypeError('generated_at_invalid');
  const sources = {
    primary: sanitizedSource(primarySource, 'repository_api_link_pagination'),
    independent: sanitizedSource(independentSource, 'gh_api_paginate')
  };
  const reconciliation = providerCeilingAmbiguous
    ? { verified: false, reason: 'provider_ceiling_ambiguous', commitSha }
    : reconcileWorkflowEnumerations({ primary, independent, commitSha });
  return {
    schema_version: 1,
    evidence_type: 'vercel_exact_commit_workflow_enumeration_bundle',
    commit_sha: commitSha,
    generated_at: generatedAt,
    verified: reconciliation.verified === true,
    evidence_strength: reconciliation.verified === true ? 'strong' : 'rejected',
    sources,
    raw_enumeration_digests: { primary_sha256: digest(primary), independent_sha256: digest(independent) },
    reconciliation,
    retention_contract: {
      retain_raw_primary: true,
      retain_raw_independent: true,
      retain_bundle: true,
      secrets_forbidden: true,
      minimum_fields: ['commit_sha', 'source_method', 'retrieved_at', 'pages_fetched', 'sha256']
    }
  };
}
