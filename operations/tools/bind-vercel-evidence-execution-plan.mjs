import { createHash } from 'node:crypto';
import { validateVercelEvidenceExecutionPlan } from './validate-vercel-evidence-execution-plan.mjs';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Validate a V-001 execution plan and bind the canonical validated plan to a
 * SHA-256 digest. Downstream retained evidence can record this digest to prove
 * it refers to the same repository, commit, command, and canonical output set.
 */
export function bindVercelEvidenceExecutionPlan(plan) {
  const validation = validateVercelEvidenceExecutionPlan(plan);
  if (!validation.ok) {
    return {
      ...validation,
      plan_binding_created: false,
    };
  }

  const canonicalPlan = {
    schema_version: 1,
    repository: validation.repository,
    commit_sha: validation.commitSha,
    command: plan.command.trim(),
    outputs: validation.outputs,
    overwrite: false,
    pending: false,
    deployment_requested: false,
  };
  const canonical = stableJson(canonicalPlan);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');

  return {
    ...validation,
    evidence_class: 'validated_execution_plan_with_sha256_binding',
    plan_binding_created: true,
    plan_binding: {
      algorithm: 'sha256',
      digest,
      canonicalization: 'recursive_lexicographic_object_keys_preserve_array_order',
      schema_version: 1,
    },
    canonical_plan: canonicalPlan,
    claim_boundary: [
      ...validation.claim_boundary,
      'The SHA-256 binding proves only that later evidence carrying the same digest refers to this canonical validated execution plan; it does not prove the plan was executed or that retained outputs are authentic, complete, or deployment-bound.',
    ],
  };
}
