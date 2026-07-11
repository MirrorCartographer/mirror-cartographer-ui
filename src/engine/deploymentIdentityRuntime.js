const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function buildDeploymentIdentity(env = {}) {
  const commit = String(
    env.VITE_GIT_COMMIT_SHA ||
    env.VITE_VERCEL_GIT_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    '',
  ).trim();
  const deploymentUrl = String(
    env.VITE_DEPLOYMENT_URL ||
    env.VITE_VERCEL_URL ||
    env.VERCEL_URL ||
    '',
  ).trim();
  const provider = deploymentUrl.includes('vercel') || env.VERCEL === '1' ? 'vercel' : 'unknown';
  const commitResolved = SHA_PATTERN.test(commit);

  return Object.freeze({
    schemaVersion: '1.0.0',
    provider,
    commit: commitResolved ? commit.toLowerCase() : null,
    commitResolved,
    deploymentUrl: deploymentUrl || null,
    verificationState: commitResolved ? 'source-identified' : 'source-unresolved',
  });
}

export function installDeploymentIdentityRuntime(env = import.meta.env) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const identity = buildDeploymentIdentity(env);
  window.__MC_DEPLOYMENT_IDENTITY__ = identity;

  const root = document.documentElement;
  root.dataset.deploymentProvider = identity.provider;
  root.dataset.deploymentIdentity = identity.verificationState;
  if (identity.commit) root.dataset.deploymentCommit = identity.commit;

  let marker = document.querySelector('meta[name="mc-deployment-identity"]');
  if (!marker) {
    marker = document.createElement('meta');
    marker.name = 'mc-deployment-identity';
    document.head.appendChild(marker);
  }
  marker.content = JSON.stringify(identity);

  return identity;
}
