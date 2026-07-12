import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceOutcomes as OUTCOMES, validateEvidence } from './vercel-exact-commit-runtime-evidence.mjs';

const valid = {
  schema_version: 1,
  queue_item: 'V-001',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'a'.repeat(40),
  trigger_provenance: {
    event_name: 'push',
    ref: 'refs/heads/main',
    ref_name: 'main',
    ref_type: 'branch'
  },
  run_identity: {
    provider: 'github_actions',
    run_id: '42',
    run_attempt: '1',
    started_at: '2026-07-12T16:30:00Z',
    completed_at: '2026-07-12T16:31:00Z',
    immutable_url: 'https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/42'
  },
  source_checkout: { observed_sha: 'a'.repeat(40), dirty: false, match: true },
  test_execution: {
    command: 'node --test scripts/vercel-exact-commit-runtime-evidence.test.mjs',
    exit_code: 0,
    artifact_digest: `sha256:${'b'.repeat(64)}`,
    artifact_url: 'https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/42/artifacts/7',
    artifact_name: `vercel-evidence-contract-${'a'.repeat(40)}-1`
  },
  audio_outcomes: { expected_set: OUTCOMES, observed_set: OUTCOMES, complete: true },
  deployment_binding: {
    attempted: true,
    immutable_deployment_url: 'https://mirror-cartographer-ui-abc.vercel.app',
    provider_commit_sha: 'a'.repeat(40),
    match: true,
    status: 'successful'
  },
  physical_device: {
    performed: true,
    platform: 'iOS 18',
    browser: 'Safari',
    result: 'pass',
    evidence_url: 'https://example.test/device-proof'
  },
  classification: 'fully_verified',
  limits: []
};

test('accepts complete exact-commit evidence', () => {
  assert.deepEqual(validateEvidence(valid), []);
});

test('rejects false fully_verified classification', () => {
  const invalid = structuredClone(valid);
  invalid.source_checkout.match = false;
  invalid.test_execution.exit_code = 1;
  invalid.audio_outcomes.complete = false;
  invalid.deployment_binding.status = 'blocked';
  invalid.physical_device.result = 'inconclusive';
  assert.ok(validateEvidence(invalid).length >= 5);
});

test('rejects missing six-outcome set', () => {
  const invalid = structuredClone(valid);
  invalid.audio_outcomes.expected_set = OUTCOMES.slice(0, 5);
  assert.ok(validateEvidence(invalid).includes('audio_outcomes.expected_set'));
});

test('rejects evidence without trigger provenance', () => {
  const invalid = structuredClone(valid);
  delete invalid.trigger_provenance;
  assert.deepEqual(
    validateEvidence(invalid).filter((path) => path.startsWith('trigger_provenance.')),
    [
      'trigger_provenance.event_name',
      'trigger_provenance.ref',
      'trigger_provenance.ref_name',
      'trigger_provenance.ref_type'
    ]
  );
});

test('rejects unsupported trigger event and malformed ref', () => {
  const invalid = structuredClone(valid);
  invalid.trigger_provenance.event_name = 'schedule';
  invalid.trigger_provenance.ref = 'main';
  assert.ok(validateEvidence(invalid).includes('trigger_provenance.event_name'));
  assert.ok(validateEvidence(invalid).includes('trigger_provenance.ref'));
});

test('validator module imports without registering node:test cases', async () => {
  const before = process.listenerCount('test:pass');
  const module = await import(`./vercel-exact-commit-runtime-evidence.mjs?isolation=${Date.now()}`);
  assert.equal(typeof module.validateEvidence, 'function');
  assert.equal(process.listenerCount('test:pass'), before);
});
