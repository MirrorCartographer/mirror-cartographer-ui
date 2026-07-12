import crypto from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40}$/i;
const OUTCOMES = new Set(['accepted', 'rejected', 'contradicted', 'incomplete', 'invalid', 'identity_mismatch']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function evaluateAudioAcceptanceBundle(bundle = {}) {
  const failures = [];
  const identity = bundle.identity || {};
  const browser = bundle.browser_evidence || {};
  const physical = bundle.physical_verification || {};

  if (!SHA_RE.test(identity.commit_sha || '')) failures.push('commit_sha_invalid');
  if (typeof identity.deployment_id !== 'string' || identity.deployment_id.length < 3) failures.push('deployment_id_invalid');
  if (typeof identity.deployment_url !== 'string' || !identity.deployment_url.startsWith('https://')) failures.push('deployment_url_invalid');

  const browserPresent = Object.keys(browser).length > 0;
  const physicalPresent = Object.keys(physical).length > 0;
  const identityMismatch = [browser, physical].some((record) => {
    if (!record || Object.keys(record).length === 0) return false;
    return (record.commit_sha && record.commit_sha !== identity.commit_sha)
      || (record.deployment_id && record.deployment_id !== identity.deployment_id)
      || (record.deployment_url && record.deployment_url !== identity.deployment_url);
  });

  let outcome;
  if (failures.length) outcome = 'invalid';
  else if (identityMismatch) outcome = 'identity_mismatch';
  else if (!browserPresent || !physicalPresent) outcome = 'incomplete';
  else if (browser.valid !== true || physical.valid !== true) outcome = 'invalid';
  else if (browser.contradiction_preserved === true || physical.classification === 'contradicted') outcome = 'contradicted';
  else if (browser.attestation?.binding?.classification === 'rejected' || physical.classification === 'rejected') outcome = 'rejected';
  else if (browser.valid === true && physical.accepted === true) outcome = 'accepted';
  else outcome = 'incomplete';

  if (!OUTCOMES.has(outcome)) throw new Error('outcome_unreachable');

  const payload = stable({
    schema_version: 1,
    identity,
    browser_evidence: browser,
    physical_verification: physical,
    outcome,
    failures
  });

  return Object.freeze({
    valid: outcome !== 'invalid' && outcome !== 'identity_mismatch',
    accepted: outcome === 'accepted',
    outcome,
    failures: Object.freeze(failures),
    contradiction_preserved: outcome === 'contradicted',
    evidence_digest: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    claim_boundary: 'Combines commit-bound browser and bounded physical evidence. It does not prove device identity, deployment ownership, speaker output causality, or universal audibility.'
  });
}
