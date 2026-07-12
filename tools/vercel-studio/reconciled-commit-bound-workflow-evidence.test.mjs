import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReconciledCommitBoundWorkflowEvidence } from './reconciled-commit-bound-workflow-evidence.mjs';

const sha = 'a'.repeat(40);
const base = {
  complete: true,
  reason: 'exhausted_pagination',
  commitSha: sha,
  pagesFetched: 1,
  runs: [{
    id: 7,
    head_sha: sha,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    workflow_id: 3,
    run_attempt: 1,
    html_url: 'https://example.test/7'
  }],
  coverage: {
    eventFilterApplied: false,
    headShaFilterApplied: true,
    perPage: 100,
    paginationExhausted: true,
    crossCommitRunsRejected: true
  }
};

test('promotes only independently reconciled exhaustive evidence', () => {
  const result = buildReconciledCommitBoundWorkflowEvidence({
    commitSha: sha,
    primary: base,
    independent: structuredClone(base)
  });
  assert.equal(result.evidence_strength, 'strong');
  assert.equal(result.reconciliation.verified, true);
  assert.equal(result.independent_enumeration.run_count, 1);
});

test('rejects divergent enumerations', () => {
  const independent = { ...structuredClone(base), runs: [] };
  const result = buildReconciledCommitBoundWorkflowEvidence({ commitSha: sha, primary: base, independent });
  assert.equal(result.evidence_strength, 'rejected');
  assert.equal(result.errors[0], 'reconciliation_failed:enumeration_divergence');
});

test('rejects provider ceiling ambiguity before reconciliation', () => {
  const result = buildReconciledCommitBoundWorkflowEvidence({
    commitSha: sha,
    primary: base,
    independent: base,
    providerCeilingAmbiguous: true
  });
  assert.deepEqual(result.errors, ['provider_ceiling_ambiguous']);
});

test('retains reconciliation when primary coverage contract is weak', () => {
  const primary = { ...structuredClone(base), coverage: { ...base.coverage, eventFilterApplied: true } };
  const independent = structuredClone(primary);
  const result = buildReconciledCommitBoundWorkflowEvidence({ commitSha: sha, primary, independent });
  assert.equal(result.evidence_strength, 'rejected');
  assert.equal(result.reconciliation.verified, true);
  assert.deepEqual(result.errors, ['enumeration_coverage_contract_failed']);
});
