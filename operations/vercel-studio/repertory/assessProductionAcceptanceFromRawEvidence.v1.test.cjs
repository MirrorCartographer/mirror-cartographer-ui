'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessProductionAcceptanceFromRawEvidence } = require('./assessProductionAcceptanceFromRawEvidence.v1.cjs');

const commit = 'a'.repeat(40);
const deployment = 'dpl_123';
const activation = {
  promotable: true,
  expected_commit_sha: commit,
  immutable_deployment_verified: true,
  claim_boundary: 'repertory_activation_preconditions_verified_only',
};
const raw = {
  tested_commit: commit,
  deployment_id: deployment,
  deployment_hostname: 'x.vercel.app',
  device_model: 'iPhone 15',
  os_version: '18.5',
  safari_version: '18.5',
  tester_id: 'human-1',
  observed_at: '2026-07-15T08:20:00Z',
  platform: 'ios_safari_physical_device',
  user_gesture: true,
  context_state_after_gesture: 'running',
  source_started: true,
  destination_connected: true,
  volume_nonzero: true,
  hardware_mute_checked: true,
  output_route_checked: true,
  human_audibility_observation: true,
  outcome: 'audible_confirmed',
};

test('accepts only aligned raw physical-device evidence', () => {
  const result = assessProductionAcceptanceFromRawEvidence({
    expected_commit_sha: commit,
    expected_deployment_id: deployment,
    activation_assessment: activation,
    raw_audibility_evidence: raw,
  });
  assert.equal(result.accepted, true);
  assert.match(result.evidence.audibility_evidence_digest, /^[a-f0-9]{64}$/);
});

test('rejects fabricated summary without raw evidence', () => {
  const result = assessProductionAcceptanceFromRawEvidence({
    expected_commit_sha: commit,
    expected_deployment_id: deployment,
    activation_assessment: activation,
    audibility_assessment: { verified: true },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes('physical_audibility_unverified'));
});

test('rejects raw evidence bound to another deployment', () => {
  const result = assessProductionAcceptanceFromRawEvidence({
    expected_commit_sha: commit,
    expected_deployment_id: deployment,
    activation_assessment: activation,
    raw_audibility_evidence: { ...raw, deployment_id: 'dpl_other' },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes('audibility_deployment_mismatch'));
});

test('rejects non-human audibility observation', () => {
  const result = assessProductionAcceptanceFromRawEvidence({
    expected_commit_sha: commit,
    expected_deployment_id: deployment,
    activation_assessment: activation,
    raw_audibility_evidence: { ...raw, human_audibility_observation: false },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.evidence.audibility_reasons.includes('human_audibility_not_observed'));
});
