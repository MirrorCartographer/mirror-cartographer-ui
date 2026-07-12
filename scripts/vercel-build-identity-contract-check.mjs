import assert from 'node:assert/strict';
import {
  DEPLOYMENT_IDENTITY_PATH,
  createDeploymentIdentityManifest,
  resolveDeploymentIdentityEnv,
} from '../vite.config.js';

const sha = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
const resolved = resolveDeploymentIdentityEnv({
  VERCEL: '1',
  VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_URL: 'mirror-cartographer-ui-example.vercel.app',
});

assert.equal(resolved.VITE_GIT_COMMIT_SHA, sha.toLowerCase());
assert.equal(resolved.VITE_VERCEL_URL, 'mirror-cartographer-ui-example.vercel.app');
assert.equal(resolved.VITE_DEPLOYMENT_PROVIDER, 'vercel');

const manifest = createDeploymentIdentityManifest(resolved);
assert.deepEqual(manifest, {
  schema_version: 1,
  application: 'mirror-cartographer-ui',
  commit_sha: sha.toLowerCase(),
  deployment_provider: 'vercel',
  deployment_url: 'mirror-cartographer-ui-example.vercel.app',
  claim_scope: 'build-identity-only',
});
assert.equal(DEPLOYMENT_IDENTITY_PATH, '.well-known/mirror-cartographer-deployment.json');

const fallback = resolveDeploymentIdentityEnv({
  GITHUB_SHA: sha,
});
assert.equal(fallback.VITE_GIT_COMMIT_SHA, sha.toLowerCase());

const malformed = resolveDeploymentIdentityEnv({
  VERCEL: '1',
  VERCEL_GIT_COMMIT_SHA: 'main',
  VERCEL_URL: 'mirror-cartographer-ui-example.vercel.app',
});
assert.equal(malformed.VITE_GIT_COMMIT_SHA, '');
assert.equal(malformed.VITE_DEPLOYMENT_PROVIDER, 'vercel');
assert.equal(
  createDeploymentIdentityManifest(malformed).claim_scope,
  'build-identity-unavailable',
);

const absent = resolveDeploymentIdentityEnv({});
assert.deepEqual(absent, {
  VITE_GIT_COMMIT_SHA: '',
  VITE_VERCEL_URL: '',
  VITE_DEPLOYMENT_PROVIDER: '',
});

console.log('Vercel build identity contract passed: 7/7');