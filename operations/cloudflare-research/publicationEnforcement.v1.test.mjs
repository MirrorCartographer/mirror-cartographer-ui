import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeStaticAsset, authorizeWorkerResponse, SAFE_RESPONSE_HEADERS } from './publicationEnforcement.v1.mjs';

const packet = {
  schema_version: 1,
  packet_id: 'CF-002-demo',
  audience: 'public',
  privacy_class: 'public',
  claim_type: 'research_summary',
  evidence_state: 'observed',
  contains_personal_identifiers: false,
  sources: [{ locator: 'repo://operations/cloudflare-research', source_status: 'repository', accessed_at: '2026-07-16T00:20:57Z' }],
  falsification_route: 'Run the deterministic contract tests and inspect the returned gate decision.'
};

test('rejected packet cannot invoke static renderer or create an artifact', () => {
  let called = false;
  const result = authorizeStaticAsset({ ...packet, claim_type: 'diagnosis' }, () => { called = true; return '<html>unsafe</html>'; });
  assert.equal(called, false);
  assert.equal(result.allowed, false);
  assert.equal(result.artifact, null);
  assert.ok(result.assessment.reasons.includes('medical_claim_forbidden'));
});

test('rejected packet cannot invoke worker renderer and returns non-disclosing denial', () => {
  let called = false;
  const result = authorizeWorkerResponse({ ...packet, privacy_class: 'private' }, () => { called = true; return { body: 'unsafe' }; });
  assert.equal(called, false);
  assert.equal(result.allowed, false);
  assert.equal(result.status, 404);
  assert.equal(result.body, 'Not found');
  assert.deepEqual(result.headers, SAFE_RESPONSE_HEADERS);
});

test('accepted static packet renders exactly once', () => {
  let calls = 0;
  const result = authorizeStaticAsset(packet, (input) => { calls += 1; return `${input.packet_id}.html`; });
  assert.equal(calls, 1);
  assert.equal(result.allowed, true);
  assert.equal(result.artifact, 'CF-002-demo.html');
});

test('accepted worker packet receives mandatory runtime security headers', () => {
  const result = authorizeWorkerResponse(packet, () => ({ body: 'public research', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  assert.equal(result.allowed, true);
  assert.equal(result.status, 200);
  assert.equal(result.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.equal(result.headers['Content-Type'], 'text/plain; charset=utf-8');
});

test('renderer cannot weaken mandatory worker security headers', () => {
  const result = authorizeWorkerResponse(packet, () => ({ body: 'public research', headers: { 'X-Robots-Tag': 'index', 'Cache-Control': 'public' } }));
  assert.equal(result.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
