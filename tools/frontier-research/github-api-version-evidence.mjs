const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1]) : null;
}

function parseHttpDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function assessGitHubApiVersionEvidence({
  requestedVersion,
  responseStatus,
  responseHeaders,
  retrievedAt,
  supportedVersionsSnapshot
}) {
  if (!VERSION_PATTERN.test(requestedVersion || '')) {
    throw new TypeError('requestedVersion must be a YYYY-MM-DD GitHub REST API version');
  }
  if (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
    throw new TypeError('responseStatus must be an HTTP status integer');
  }
  if (!retrievedAt || !Number.isFinite(Date.parse(retrievedAt))) {
    throw new TypeError('retrievedAt must be an ISO-compatible timestamp');
  }
  if (!supportedVersionsSnapshot || !Array.isArray(supportedVersionsSnapshot.versions)) {
    throw new TypeError('supportedVersionsSnapshot.versions is required');
  }

  const supported = supportedVersionsSnapshot.versions.find(
    (entry) => entry?.version === requestedVersion
  );
  const deprecation = parseHttpDate(headerValue(responseHeaders, 'deprecation'));
  const sunset = parseHttpDate(headerValue(responseHeaders, 'sunset'));
  const snapshotObservedAt = supportedVersionsSnapshot.observedAt;
  const snapshotSource = supportedVersionsSnapshot.source;

  const reasons = [];
  if (!snapshotSource) reasons.push('missing_snapshot_source');
  if (!snapshotObservedAt || !Number.isFinite(Date.parse(snapshotObservedAt))) {
    reasons.push('invalid_snapshot_observed_at');
  }
  if (!supported) reasons.push('requested_version_absent_from_supported_snapshot');
  if (responseStatus === 410) reasons.push('api_version_gone');
  if (responseStatus < 200 || responseStatus >= 300) reasons.push(`http_${responseStatus}`);
  if (deprecation) reasons.push('deprecation_header_observed');
  if (sunset) reasons.push('sunset_header_observed');

  const migrationRequired = Boolean(
    !supported || responseStatus === 410 || deprecation || sunset
  );
  const verified = reasons.length === 0;

  return {
    schemaVersion: 1,
    requestedVersion,
    responseStatus,
    retrievedAt: new Date(retrievedAt).toISOString(),
    supportedSnapshot: {
      source: snapshotSource || null,
      observedAt: snapshotObservedAt || null,
      latestVersion: supportedVersionsSnapshot.latestVersion || null,
      requestedVersionEndOfSupport: supported?.endOfSupport || null
    },
    responseLifecycleHeaders: {
      deprecation,
      sunset
    },
    verified,
    migrationRequired,
    evidenceStrength: verified ? 'primary_source_plus_observed_response' : 'fail_closed',
    reasons
  };
}
