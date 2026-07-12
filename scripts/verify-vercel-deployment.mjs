import { pathToFileURL } from 'node:url';
import { verifyVercelDeploymentIdentity } from './vercel-deployment-identity-verifier.mjs';

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

export async function buildVercelVerificationEvidence({
  siteUrl,
  expectedCommit,
  fetchImpl = fetch,
  now = () => new Date(),
}) {
  const identity = await verifyVercelDeploymentIdentity({
    siteUrl: required(siteUrl, 'siteUrl'),
    expectedCommit: required(expectedCommit, 'expectedCommit'),
    fetchImpl,
  });

  return {
    schema_version: '1.0.0',
    kind: 'mirror-cartographer-vercel-deployment-verification',
    generated_at: now().toISOString(),
    status: 'verified',
    deployment: identity,
    limits: [
      'Deployment identity proves which immutable commit was served, not that audio was audible.',
      'A phone-side report or device-level acoustic measurement is still required for V-001 completion.',
      'This packet contains no credentials, private chat, health material, payment, or conversion data.',
    ],
  };
}

export async function main({
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  fetchImpl = fetch,
} = {}) {
  try {
    const evidence = await buildVercelVerificationEvidence({
      siteUrl: env.SITE_URL,
      expectedCommit: env.EXPECTED_COMMIT,
      fetchImpl,
    });
    stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`Vercel deployment verification failed: ${error.message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
