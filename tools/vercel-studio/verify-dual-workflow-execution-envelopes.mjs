import { validateWorkflowEnumerationExecutionEnvelope } from '../../operations/tools/validate-workflow-enumeration-execution-envelope.mjs';

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

export function verifyDualWorkflowExecutionEnvelopes({
  expectedRepository,
  expectedCommitSha,
  primaryEnvelope,
  independentEnvelope
}) {
  if (typeof expectedRepository !== 'string' || !expectedRepository.includes('/')) {
    return fail('invalid_expected_repository');
  }
  if (!/^[0-9a-f]{40}$/.test(expectedCommitSha ?? '')) {
    return fail('invalid_expected_commit_sha');
  }

  const primary = validateWorkflowEnumerationExecutionEnvelope(primaryEnvelope);
  if (primary.verified !== true) {
    return fail('primary_execution_envelope_rejected', { primary });
  }

  const independent = validateWorkflowEnumerationExecutionEnvelope(independentEnvelope);
  if (independent.verified !== true) {
    return fail('independent_execution_envelope_rejected', { independent });
  }

  for (const [label, envelope] of [
    ['primary', primaryEnvelope],
    ['independent', independentEnvelope]
  ]) {
    if (envelope.repository !== expectedRepository) {
      return fail(`${label}_repository_mismatch`, {
        expected: expectedRepository,
        observed: envelope.repository
      });
    }
    if (envelope.commit_sha !== expectedCommitSha) {
      return fail(`${label}_commit_mismatch`, {
        expected: expectedCommitSha,
        observed: envelope.commit_sha
      });
    }
  }

  if (primaryEnvelope.api_version !== independentEnvelope.api_version) {
    return fail('api_version_divergence', {
      primary: primaryEnvelope.api_version,
      independent: independentEnvelope.api_version
    });
  }
  if (primaryEnvelope.records_digest !== independentEnvelope.records_digest) {
    return fail('records_digest_divergence', {
      primary: primaryEnvelope.records_digest,
      independent: independentEnvelope.records_digest
    });
  }
  if (primaryEnvelope.total_count !== independentEnvelope.total_count) {
    return fail('total_count_divergence', {
      primary: primaryEnvelope.total_count,
      independent: independentEnvelope.total_count
    });
  }

  return {
    verified: true,
    reason: 'dual_execution_envelopes_verified',
    repository: expectedRepository,
    commit_sha: expectedCommitSha,
    api_version: primaryEnvelope.api_version,
    records_digest: primaryEnvelope.records_digest,
    total_count: primaryEnvelope.total_count,
    primary_execution_digest: primary.execution_digest,
    independent_execution_digest: independent.execution_digest,
    claim_boundary: [
      'This result proves only that two retained execution envelopes independently satisfy the pinned API contract and agree on exact-commit record identity.',
      'It does not prove that raw retained files match these envelopes unless byte-binding verification is performed separately.',
      'It does not prove deployment identity, browser behavior, audio audibility, or physical-device acceptance.'
    ]
  };
}

export default verifyDualWorkflowExecutionEnvelopes;
