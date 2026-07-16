import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeStaticAsset, authorizeWorkerResponse } from './publicationEnforcement.v2.mjs';

const NOW = new Date('2026-07-16T14:04:17Z');
const packet = {
  schema_version: 1,
  packet_id: 'CF-002-enforcement',
  audience: 'public',
  privacy_class: 'public',
  claim_type: 'infrastructure_status',
  evidence_state: 'observed',
  contains_personal_identifiers: false,
  sources: [{
    locator: 'https://developers.cloudflare.com/pages/configuration/build-configuration/',
    source_status: 'primary',
    accessed_at: '2026-07-16T13:30:00Z'
  }],
  falsification_route: 'Re-fetch the configuration documentation and compare the branch and output mapping.'
};

test('allows fresh static research packets', () => {
  const result = authorizeStaticAsset(packet, () => '<html>ok</html>', { now: NOW });
  assert.equal(result.allowed, true);
});

test('denies stale packets before render executes', () => {
  let rendered = false;
  const stale = {
    ...packet,
    sources: [{ ...packet.sources[0], accessed_at: '2026-05-01T00:00:00Z' }]
  };
  const result = authorizeStaticAsset(stale, () => {
    rendered = true;
    return '<html>unsafe</html>';
  }, { now: NOW });
  assert.equal(result.allowed, false);
  assert.equal(rendered, false);
  assert.ok(result.assessment.reasons.includes('source_evidence_stale'));
});

test('denies future-dated worker evidence with non-indexable response', () => {
  const future = {
    ...packet,
    sources: [{ ...packet.sources[0], accessed_at: '2026-07-18T00:00:00Z' }]
  };
  const result = authorizeWorkerResponse(future, () => ({ body: 'unsafe' }), { now: NOW });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 404);
  assert.equal(result.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.ok(result.assessment.reasons.includes('source_timestamp_in_future'));
});
