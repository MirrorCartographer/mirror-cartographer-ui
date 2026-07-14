import assert from 'node:assert/strict';
import { validateEvidenceTemporalCoherence } from './evidence-temporal-coherence.mjs';

function validEvidence() {
  return {
    captured_at: '2026-07-14T03:30:00Z',
    primary: {
      execution: {
        started_at: '2026-07-14T03:00:00Z',
        completed_at: '2026-07-14T03:02:00Z'
      }
    },
    independent: {
      execution: {
        started_at: '2026-07-14T03:03:00Z',
        completed_at: '2026-07-14T03:05:00Z'
      }
    },
    stabilization: {
      first_snapshot_at: '2026-07-14T03:10:00Z',
      second_snapshot_at: '2026-07-14T03:20:00Z'
    }
  };
}

const valid = validEvidence();
let result = validateEvidenceTemporalCoherence(valid);
assert.equal(result.verified, true);
assert.equal(result.reason, 'evidence_temporal_coherence_verified');
assert.equal(result.claim_boundary.proves_clock_authenticity, false);

result = validateEvidenceTemporalCoherence(null);
assert.equal(result.reason, 'evidence_invalid');

const missingExecution = structuredClone(valid);
delete missingExecution.primary.execution;
assert.equal(validateEvidenceTemporalCoherence(missingExecution).reason, 'execution_missing');

const invalidStart = structuredClone(valid);
invalidStart.primary.execution.started_at = 'not-a-date';
assert.equal(validateEvidenceTemporalCoherence(invalidStart).reason, 'timestamp_invalid');

const invertedExecution = structuredClone(valid);
invertedExecution.independent.execution.completed_at = '2026-07-14T03:01:00Z';
result = validateEvidenceTemporalCoherence(invertedExecution);
assert.equal(result.reason, 'execution_interval_inverted');
assert.equal(result.method, 'independent');

const futureExecution = structuredClone(valid);
futureExecution.primary.execution.completed_at = '2026-07-14T03:31:00Z';
result = validateEvidenceTemporalCoherence(futureExecution);
assert.equal(result.reason, 'execution_completed_after_capture');
assert.equal(result.method, 'primary');

const invertedSnapshots = structuredClone(valid);
invertedSnapshots.stabilization.second_snapshot_at = '2026-07-14T03:09:00Z';
assert.equal(validateEvidenceTemporalCoherence(invertedSnapshots).reason, 'snapshot_interval_inverted');

const futureSnapshot = structuredClone(valid);
futureSnapshot.stabilization.second_snapshot_at = '2026-07-14T03:31:00Z';
assert.equal(validateEvidenceTemporalCoherence(futureSnapshot).reason, 'snapshot_completed_after_capture');

const invalidCapture = structuredClone(valid);
invalidCapture.captured_at = '';
assert.equal(validateEvidenceTemporalCoherence(invalidCapture).reason, 'timestamp_missing');

console.log('9 assertions passed');
