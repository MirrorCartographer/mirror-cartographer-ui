import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPublicationPacket } from './publicationBoundary.v2.mjs';

const NOW = new Date('2026-07-16T14:04:17Z');
const base = {
  schema_version: 1,
  packet_id: 'CF-002-freshness',
  audience: 'public',
  privacy_class: 'public',
  claim_type: 'research_summary',
  evidence_state: 'observed',
  contains_personal_identifiers: false,
  sources: [{
    locator: 'https://developers.cloudflare.com/workers/static-assets/headers/',
    source_status: 'primary',
    accessed_at: '2026-07-16T13:30:00Z'
  }],
  falsification_route: 'Re-fetch the cited primary documentation and compare the stated behavior.'
};

function assess(overrides = {}) {
  return assessPublicationPacket({ ...base, ...overrides }, { now: NOW });
}

test('accepts fresh commit-independent primary research evidence', () => {
  assert.equal(assess().publishable, true);
});

test('rejects malformed source timestamps that v1 treated as nonblank', () => {
  const result = assess({ sources: [{ ...base.sources[0], accessed_at: 'recently' }] });
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('source_timestamp_invalid'));
});

test('rejects future-dated evidence beyond clock-skew tolerance', () => {
  const result = assess({ sources: [{ ...base.sources[0], accessed_at: '2026-07-17T14:04:17Z' }] });
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('source_timestamp_in_future'));
});

test('rejects stale observed evidence', () => {
  const result = assess({ sources: [{ ...base.sources[0], accessed_at: '2026-05-01T00:00:00Z' }] });
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('source_evidence_stale'));
});

test('allows a wider but bounded window for inferred evidence', () => {
  const result = assess({
    evidence_state: 'inferred',
    uncertainty_statement: 'The inference may change if Cloudflare updates the documented behavior.',
    sources: [{ ...base.sources[0], accessed_at: '2026-03-01T00:00:00Z' }]
  });
  assert.equal(result.publishable, true);
});

test('rejects duplicate locators disguised by case or whitespace', () => {
  const result = assess({
    sources: [
      base.sources[0],
      { ...base.sources[0], locator: '  HTTPS://DEVELOPERS.CLOUDFLARE.COM/WORKERS/STATIC-ASSETS/HEADERS/  ' }
    ]
  });
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('duplicate_source_locator'));
});

test('fails closed when verification time is invalid', () => {
  const result = assessPublicationPacket(base, { nowMs: Number.NaN });
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('verification_time_invalid'));
});
