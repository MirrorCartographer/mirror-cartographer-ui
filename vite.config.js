import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

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

export default defineConfig(() => {
  const deploymentIdentity = resolveDeploymentIdentityEnv();

  return {
    base: './',
    plugins: [react()],
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
