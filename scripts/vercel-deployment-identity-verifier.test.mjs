import assert from 'node:assert/strict';
import { assertAllowedDeploymentUrl, verifyVercelDeploymentIdentity } from './vercel-deployment-identity-verifier.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const headers = new Headers({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=0, no-store',
  'x-content-type-options': 'nosniff',
});

assert.equal(assertAllowedDeploymentUrl('https://mirror-cartographer-ui.vercel.app').hostname, 'mirror-cartographer-ui.vercel.app');
assert.throws(() => assertAllowedDeploymentUrl('https://mirror-cartographer-ui.vercel.app.evil.example'), /not allowlisted/);

const verified = await verifyVercelDeploymentIdentity({
  siteUrl: 'https://mirror-cartographer-ui.vercel.app',
  expectedCommit: SHA,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    url: 'https://mirror-cartographer-ui.vercel.app/.well-known/mirror-cartographer-deployment.json',
    headers,
    json: async () => ({ commit_sha: SHA }),
  }),
});
assert.equal(verified.status, 'verified');
assert.equal(verified.served_commit, SHA);

await assert.rejects(
  verifyVercelDeploymentIdentity({
    siteUrl: 'https://mirror-cartographer-ui.vercel.app',
    expectedCommit: SHA,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: 'https://mirror-cartographer-ui.vercel.app/.well-known/mirror-cartographer-deployment.json',
      headers,
      json: async () => ({ commit_sha: 'ffffffffffffffffffffffffffffffffffffffff' }),
    }),
  }),
  /commit mismatch/,
);

await assert.rejects(
  verifyVercelDeploymentIdentity({
    siteUrl: 'https://mirror-cartographer-ui.vercel.app',
    expectedCommit: SHA,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: 'https://attacker.example/identity.json',
      headers,
      json: async () => ({ commit_sha: SHA }),
    }),
  }),
  /not allowlisted/,
);

console.log('Vercel deployment identity verifier passed: 5/5');
