import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyAudioRoutingEvidence } from './verify-vercel-studio-audio-evidence.mjs';

const valid = {
  schema_version: 2,
  queue_item: 'V-001',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'abc123',
  workflow: 'Vercel Studio Audio Routing Evidence',
  run_id: '42',
  generated_at_utc: '2026-07-12T03:01:00.000Z',
  outcomes: {
    dependencies: 'success',
    browser_install: 'success',
    source_contract: 'success',
    browser_regression: 'success',
    evidence_verifier: 'success',
    production_build: 'success',
  },
  verification_passed: true,
  evidence_scope: 'dependency install, browser install, source contract, browser regression, evidence verifier, and production build; not physical speaker emission or Vercel deployment',
};

const expected = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commitSha: 'abc123',
};

test('accepts a fully bound passing packet', () => {
  assert.deepEqual(verifyAudioRoutingEvidence(valid, expected), { ok: true, errors: [] });
});

test('rejects a self-asserted pass when browser regression failed', () => {
  const evidence = structuredClone(valid);
  evidence.outcomes.browser_regression = 'failure';
  const result = verifyAudioRoutingEvidence(evidence, expected);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /browser_regression must equal success/);
  assert.match(result.errors.join('\n'), /verification_passed does not match required outcomes/);
});

test('rejects a packet when dependency installation failed', () => {
  const evidence = structuredClone(valid);
  evidence.outcomes.dependencies = 'failure';
  evidence.verification_passed = false;
  const result = verifyAudioRoutingEvidence(evidence, expected);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /dependencies must equal success/);
});

test('rejects a packet when verifier tests did not run', () => {
  const evidence = structuredClone(valid);
  evidence.outcomes.evidence_verifier = 'not-run';
  evidence.verification_passed = false;
  const result = verifyAudioRoutingEvidence(evidence, expected);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /evidence_verifier must equal success/);
});

test('rejects the wrong commit', () => {
  const result = verifyAudioRoutingEvidence(valid, { ...expected, commitSha: 'different' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /commit_sha mismatch/);
});

test('rejects loss of physical-device limitation', () => {
  const evidence = structuredClone(valid);
  evidence.evidence_scope = 'all audio behavior verified';
  const result = verifyAudioRoutingEvidence(evidence, expected);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /physical-speaker limitation/);
});
