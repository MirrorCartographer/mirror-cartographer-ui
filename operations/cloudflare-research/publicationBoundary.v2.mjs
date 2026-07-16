import { assessPublicationPacket as assessV1 } from './publicationBoundary.v1.mjs';

const MAX_SOURCE_AGE_MS = Object.freeze({
  observed: 30 * 24 * 60 * 60 * 1000,
  inferred: 180 * 24 * 60 * 60 * 1000,
  proposed: 180 * 24 * 60 * 60 * 1000
});

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function parseTimestamp(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedLocator(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function assessPublicationPacket(packet, options = {}) {
  const base = assessV1(packet);
  const reasons = [...base.reasons];
  const nowMs = options.now instanceof Date
    ? options.now.getTime()
    : Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();

  if (!Number.isFinite(nowMs)) reasons.push('verification_time_invalid');

  const sources = Array.isArray(packet?.sources) ? packet.sources : [];
  const locators = sources.map((source) => normalizedLocator(source?.locator)).filter(Boolean);
  if (new Set(locators).size !== locators.length) reasons.push('duplicate_source_locator');

  const maxAgeMs = MAX_SOURCE_AGE_MS[packet?.evidence_state];
  for (const source of sources) {
    const observedMs = parseTimestamp(source?.accessed_at);
    if (observedMs === null) {
      reasons.push('source_timestamp_invalid');
      continue;
    }
    if (Number.isFinite(nowMs) && observedMs > nowMs + FUTURE_TOLERANCE_MS) {
      reasons.push('source_timestamp_in_future');
    }
    if (Number.isFinite(nowMs) && Number.isFinite(maxAgeMs) && nowMs - observedMs > maxAgeMs) {
      reasons.push('source_evidence_stale');
    }
  }

  return {
    publishable: reasons.length === 0,
    reasons: [...new Set(reasons)],
    evidence_strength: base.evidence_strength
  };
}
