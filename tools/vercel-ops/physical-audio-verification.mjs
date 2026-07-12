import crypto from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40}$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function validatePhysicalAudioVerification(record = {}, options = {}) {
  const requiredTrials = Number.isInteger(options.required_trials) ? options.required_trials : 3;
  const failures = [];
  if (!SHA_RE.test(record.commit_sha || '')) failures.push('commit_sha_invalid');
  if (typeof record.deployment_id !== 'string' || record.deployment_id.length < 3) failures.push('deployment_id_invalid');
  if (typeof record.deployment_url !== 'string' || !record.deployment_url.startsWith('https://')) failures.push('deployment_url_invalid');
  if (record.device?.family !== 'iPhone') failures.push('device_not_iphone');
  if (record.browser?.name !== 'Safari') failures.push('browser_not_safari');
  if (!/^iOS\s+\d+/i.test(record.device?.os || '')) failures.push('ios_version_missing');
  if (!Array.isArray(record.trials) || record.trials.length !== requiredTrials) failures.push('trial_count_invalid');

  const trials = Array.isArray(record.trials) ? record.trials : [];
  trials.forEach((trial, index) => {
    if (trial.index !== index + 1) failures.push(`trial_${index + 1}_index_invalid`);
    if (trial.transient_activation !== true) failures.push(`trial_${index + 1}_activation_missing`);
    if (trial.route_complete !== true) failures.push(`trial_${index + 1}_route_incomplete`);
    if (trial.audio_context_state !== 'running') failures.push(`trial_${index + 1}_context_not_running`);
    if (typeof trial.audible !== 'boolean') failures.push(`trial_${index + 1}_audibility_missing`);
    if (typeof trial.observed_at !== 'string' || Number.isNaN(Date.parse(trial.observed_at))) failures.push(`trial_${index + 1}_timestamp_invalid`);
  });

  const audibleCount = trials.filter((trial) => trial.audible === true).length;
  const inaudibleCount = trials.filter((trial) => trial.audible === false).length;
  const unanimousAudible = trials.length === requiredTrials && audibleCount === requiredTrials;
  const mixedOutcome = audibleCount > 0 && inaudibleCount > 0;
  const classification = failures.length
    ? 'invalid'
    : unanimousAudible
      ? 'accepted'
      : mixedOutcome
        ? 'contradicted'
        : 'rejected';

  const payload = stable({
    schema_version: 1,
    commit_sha: record.commit_sha,
    deployment_id: record.deployment_id,
    deployment_url: record.deployment_url,
    device: record.device,
    browser: record.browser,
    trials,
    required_trials: requiredTrials,
    classification,
    failures
  });
  const evidence_digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  return Object.freeze({
    valid: failures.length === 0,
    accepted: classification === 'accepted',
    classification,
    failures: Object.freeze(failures),
    counts: Object.freeze({ audible: audibleCount, inaudible: inaudibleCount, total: trials.length }),
    contradiction_preserved: classification === 'contradicted',
    evidence_digest,
    claim_boundary: 'Validates a bounded physical observation record only; it does not prove device identity, deployment ownership, or audio causality.'
  });
}
