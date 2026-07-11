import assert from 'node:assert/strict';
import { classifyVercelDeploymentStatus } from './vercel-deployment-status-classifier.mjs';

const rateLimited = classifyVercelDeploymentStatus({
  context: 'Vercel',
  state: 'failure',
  target_url: 'https://vercel.com/project?upgradeToPro=build-rate-limit',
});
assert.equal(rateLimited.classification, 'transient_provider_rate_limit');
assert.equal(rateLimited.retryable, true);
assert.equal(rateLimited.sourceRegressionProven, false);

const success = classifyVercelDeploymentStatus({ context: 'Vercel', state: 'success' });
assert.equal(success.classification, 'provider_reports_success');
assert.equal(success.deploymentVerified, false);

const genericFailure = classifyVercelDeploymentStatus({ context: 'Vercel', state: 'failure', description: 'Build failed' });
assert.equal(genericFailure.classification, 'provider_failure_unclassified');
assert.equal(genericFailure.sourceRegressionProven, false);

const unknown = classifyVercelDeploymentStatus({ state: 'pending' });
assert.equal(unknown.classification, 'insufficient_status_evidence');
assert.equal(unknown.provider, 'unknown');

console.log('vercel deployment status classifier: 4 tests passed');
