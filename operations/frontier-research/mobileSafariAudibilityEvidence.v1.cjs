'use strict';

const crypto = require('node:crypto');

const OUTCOMES = new Set([
  'audible_confirmed',
  'inaudible_confirmed',
  'route_active_unverified',
  'context_blocked',
  'device_output_ambiguous',
  'test_incomplete'
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function assessMobileSafariAudibilityEvidence(input) {
  const reasons = [];
  const requiredStrings = ['tested_commit','deployment_id','deployment_hostname','device_model','os_version','safari_version','tester_id','observed_at'];
  for (const key of requiredStrings) if (!input || typeof input[key] !== 'string' || !input[key].trim()) reasons.push(`missing:${key}`);
  if (!input || input.platform !== 'ios_safari_physical_device') reasons.push('platform_not_physical_ios_safari');
  if (!input || input.user_gesture !== true) reasons.push('missing_direct_user_gesture');
  if (!input || input.context_state_after_gesture !== 'running') reasons.push('audio_context_not_running');
  if (!input || input.source_started !== true) reasons.push('source_not_started');
  if (!input || input.destination_connected !== true) reasons.push('destination_not_connected');
  if (!input || input.volume_nonzero !== true) reasons.push('volume_not_confirmed_nonzero');
  if (!input || input.hardware_mute_checked !== true) reasons.push('hardware_mute_unchecked');
  if (!input || input.output_route_checked !== true) reasons.push('output_route_unchecked');
  if (!input || input.human_audibility_observation !== true) reasons.push('human_audibility_not_observed');
  if (!input || !OUTCOMES.has(input.outcome)) reasons.push('invalid_outcome');
  if (input && input.outcome === 'audible_confirmed' && reasons.length) reasons.push('audible_claim_prohibited');

  const verified = reasons.length === 0 && input.outcome === 'audible_confirmed';
  return {
    schema_version: 1,
    verified,
    claim: verified ? 'physical_iPhone_Safari_audibility_confirmed_for_exact_commit_and_deployment' : 'audibility_unverified',
    reasons,
    evidence_digest: input ? digest(input) : null
  };
}

module.exports = { OUTCOMES, canonical, digest, assessMobileSafariAudibilityEvidence };
