'use strict';

const crypto = require('node:crypto');

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeHostname(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  const raw = value.trim().toLowerCase();
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

function assessGeneratedHostnameObservation(input) {
  const evidence = input && input.verified_deployment_evidence;
  const observation = input && input.observation;
  const violations = [];

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) violations.push('evidence:missing_or_invalid');
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) violations.push('observation:missing_or_invalid');
  if (!evidence || evidence.source_boundary !== 'verified_vercel_deployment_evidence_pipeline_v1') violations.push('evidence:source_boundary_invalid');
  if (!evidence || !/^[0-9a-f]{40}$/.test(evidence.expected_commit_sha || '')) violations.push('evidence:commit_invalid');
  if (!evidence || typeof evidence.deployment_id !== 'string' || evidence.deployment_id.length === 0) violations.push('evidence:deployment_id_missing');
  if (!evidence || !/^[0-9a-f]{64}$/.test(evidence.evidence_pipeline_sha256 || '')) violations.push('evidence:pipeline_sha256_invalid');

  const expectedUrl = normalizeHostname(evidence && evidence.generated_hostname);
  let requestedUrl = '';
  let finalUrl = '';
  try { requestedUrl = new URL(normalizeHostname(observation && observation.requested_url)).toString(); } catch { violations.push('observation:requested_url_invalid'); }
  try { finalUrl = new URL(normalizeHostname(observation && observation.final_url)).toString(); } catch { violations.push('observation:final_url_invalid'); }

  let canonicalExpected = '';
  try { canonicalExpected = new URL(expectedUrl).toString(); } catch { violations.push('evidence:generated_hostname_invalid'); }
  if (canonicalExpected && requestedUrl && canonicalExpected !== requestedUrl) violations.push('binding:requested_url_mismatch');
  if (canonicalExpected && finalUrl && canonicalExpected !== finalUrl) violations.push('binding:final_url_mismatch');

  const method = typeof (observation && observation.method) === 'string' ? observation.method.toUpperCase() : '';
  if (!['HEAD', 'GET'].includes(method)) violations.push('observation:method_not_safe_read');
  if (!Number.isInteger(observation && observation.status_code) || observation.status_code < 100 || observation.status_code > 599) violations.push('observation:status_code_invalid');
  if (!Number.isInteger(observation && observation.redirect_count) || observation.redirect_count < 0) violations.push('observation:redirect_count_invalid');
  if ((observation && observation.redirect_count) !== 0) violations.push('observation:redirects_present');
  if (!(observation && observation.tls_verified === true)) violations.push('observation:tls_not_verified');
  if (!(observation && typeof observation.observed_at === 'string' && !Number.isNaN(Date.parse(observation.observed_at)))) violations.push('observation:observed_at_invalid');
  if (!(observation && Number.isFinite(observation.duration_ms) && observation.duration_ms >= 0)) violations.push('observation:duration_invalid');
  if (observation && observation.network_error) violations.push('observation:network_error');

  const status = observation && observation.status_code;
  if (!(status >= 200 && status <= 299)) violations.push('observation:status_not_successful');

  if (violations.length > 0) {
    return {
      verified: false,
      violations,
      evidence: null,
      claim_boundary: 'generated_hostname_observation_rejected_no_reachability_claim'
    };
  }

  const normalized = {
    schema_version: 1,
    expected_commit_sha: evidence.expected_commit_sha,
    deployment_id: evidence.deployment_id,
    generated_hostname: evidence.generated_hostname,
    evidence_pipeline_sha256: evidence.evidence_pipeline_sha256,
    method,
    status_code: status,
    requested_url: requestedUrl,
    final_url: finalUrl,
    redirect_count: observation.redirect_count,
    tls_verified: true,
    observed_at: new Date(observation.observed_at).toISOString(),
    duration_ms: observation.duration_ms
  };

  return {
    verified: true,
    violations: [],
    evidence: { ...normalized, observation_sha256: crypto.createHash('sha256').update(canonicalize(normalized)).digest('hex') },
    claim_boundary: 'generated_hostname_https_response_verified_only_no_content_alias_audio_browser_or_device_claims'
  };
}

module.exports = { assessGeneratedHostnameObservation, canonicalize };
