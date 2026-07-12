import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
export const DEPLOYMENT_IDENTITY_PATH = '.well-known/mirror-cartographer-deployment.json';

export function resolveDeploymentIdentityEnv(env = process.env) {
  const commitCandidate = String(
    env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || env.VITE_GIT_COMMIT_SHA || '',
  ).trim();
  const deploymentUrl = String(env.VERCEL_URL || env.VITE_VERCEL_URL || '').trim();
  const commit = SHA_PATTERN.test(commitCandidate) ? commitCandidate.toLowerCase() : '';

  return Object.freeze({
    VITE_GIT_COMMIT_SHA: commit,
    VITE_VERCEL_URL: deploymentUrl,
    VITE_DEPLOYMENT_PROVIDER: env.VERCEL === '1' ? 'vercel' : '',
  });
}

export function createDeploymentIdentityManifest(identity) {
  return Object.freeze({
    schema_version: 1,
    application: 'mirror-cartographer-ui',
    commit_sha: identity.VITE_GIT_COMMIT_SHA,
    deployment_provider: identity.VITE_DEPLOYMENT_PROVIDER,
    deployment_url: identity.VITE_VERCEL_URL,
    claim_scope: identity.VITE_GIT_COMMIT_SHA
      ? 'build-identity-only'
      : 'build-identity-unavailable',
  });
}

export function deploymentIdentityManifestPlugin(identity) {
  return {
    name: 'deployment-identity-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: DEPLOYMENT_IDENTITY_PATH,
        source: `${JSON.stringify(createDeploymentIdentityManifest(identity), null, 2)}\n`,
      });
    },
  };
}

export default defineConfig(() => {
  const deploymentIdentity = resolveDeploymentIdentityEnv();

  return {
    base: './',
    plugins: [react(), deploymentIdentityManifestPlugin(deploymentIdentity)],
    define: {
      'import.meta.env.VITE_GIT_COMMIT_SHA': JSON.stringify(deploymentIdentity.VITE_GIT_COMMIT_SHA),
      'import.meta.env.VITE_VERCEL_URL': JSON.stringify(deploymentIdentity.VITE_VERCEL_URL),
      'import.meta.env.VITE_DEPLOYMENT_PROVIDER': JSON.stringify(deploymentIdentity.VITE_DEPLOYMENT_PROVIDER),
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});