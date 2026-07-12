import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploymentAdmission } from './deployment-admission.mjs';

const blocked = {
  active_delivery_item: 'V-001',
  delivery_state: 'in_progress_blocked',
  observed_blocker: 'Vercel account build-rate limit prevented immutable deployment verification.'
};

const available = {
  active_delivery_item: 'V-001',
  delivery_state: 'in_progress',
  observed_blocker: ''
};

test('allows operations-only sentinel while capacity is blocked', () => {
  const result = evaluateDeploymentAdmission({ current_state: blocked, changed_paths: ['operations/evidence/x.json'] });
  assert.equal(result.admitted, true);
  assert.equal(result.decision, 'allow_operations_only_sentinel');
});

test('denies application changes while capacity is blocked', () => {
  const result = evaluateDeploymentAdmission({ current_state: blocked, changed_paths: ['src/audio.js'], exact_commit_verification: true });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'capacity_blocked_application_affecting');
});

test('treats unknown paths as application-affecting and fails closed', () => {
  const result = evaluateDeploymentAdmission({ current_state: blocked, changed_paths: ['mystery.bin'] });
  assert.equal(result.admitted, false);
  assert.equal(result.classifications[0].kind, 'unknown');
});

test('allows one exact-commit application deployment only when capacity is available', () => {
  const result = evaluateDeploymentAdmission({ current_state: available, changed_paths: ['src/audio.js'], exact_commit_verification: true });
  assert.equal(result.admitted, true);
  assert.equal(result.decision, 'allow_single_exact_commit_deployment');
});

test('denies application deployment without exact-commit verification', () => {
  const result = evaluateDeploymentAdmission({ current_state: available, changed_paths: ['src/audio.js'] });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'exact_commit_verification_required');
});

test('rejects empty changed-path evidence', () => {
  const result = evaluateDeploymentAdmission({ current_state: available, changed_paths: [] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.failures, ['changed_paths_empty']);
});

test('digest is deterministic across path order and duplicates', () => {
  const a = evaluateDeploymentAdmission({ current_state: blocked, changed_paths: ['operations/b.json', 'operations/a.json'] });
  const b = evaluateDeploymentAdmission({ current_state: blocked, changed_paths: ['operations/a.json', 'operations/b.json', 'operations/a.json'] });
  assert.equal(a.evidence_digest, b.evidence_digest);
});
