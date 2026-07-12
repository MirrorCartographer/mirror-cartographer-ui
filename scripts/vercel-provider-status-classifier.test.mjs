import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyVercelStatus,
  evaluateDeploymentReadiness
} from './vercel-provider-status-classifier.mjs';

test('classifies the observed Vercel build-rate-limit status as a capacity blocker', () => {
  const result = classifyVercelStatus({
    context: 'Vercel',
    state: 'failure',
    target_url: 'https://vercel.com/mirror-cartographers-projects?upgradeToPro=build-rate-limit'
  });

  assert.deepEqual(result, {
    classification: 'provider_capacity_blocked',
    deployment_verified: false,
    retry_allowed: false,
    reason: 'vercel_build_rate_limit'
  });
});

test('does not treat a provider success status as immutable deployment proof', () => {
  const result = classifyVercelStatus({
    context: 'Vercel',
    state: 'success',
    target_url: 'https://vercel.com/example/deployment'
  });

  assert.equal(result.classification, 'provider_reported_success_unbound');
  assert.equal(result.deployment_verified, false);
});

test('distinguishes non-capacity failure from rate limiting', () => {
  const result = classifyVercelStatus({
    context: 'Vercel',
    state: 'failure',
    description: 'Build failed during compilation'
  });

  assert.equal(result.classification, 'provider_execution_failed');
  assert.equal(result.retry_allowed, true);
});

test('holds all deployment work while any Vercel status is capacity blocked', () => {
  const result = evaluateDeploymentReadiness([
    { context: 'lint', state: 'success' },
    {
      context: 'Vercel',
      state: 'failure',
      target_url: 'https://vercel.com/project?upgradeToPro=build-rate-limit'
    }
  ]);

  assert.equal(result.ready, false);
  assert.equal(result.decision, 'hold_for_capacity');
});

test('requires immutable commit binding even after provider-reported success', () => {
  const result = evaluateDeploymentReadiness([
    { context: 'Vercel', state: 'success' }
  ]);

  assert.equal(result.ready, false);
  assert.equal(result.decision, 'require_immutable_binding');
});
