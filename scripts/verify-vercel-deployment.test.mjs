import assert from 'node:assert/strict';
import { buildVercelVerificationEvidence, main } from './verify-vercel-deployment.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';

function headers(values) {
  return { get(name) { return values[name.toLowerCase()] ?? null; } };
}

function response({ commit = sha, url = 'https://mirror-cartographer-ui.vercel.app/.well-known/mirror-cartographer-deployment.json' } = {}) {
  return {
    ok: true,
    status: 200,
    url,
    headers: headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, no-store',
      'x-content-type-options': 'nosniff',
    }),
    async json() { return { commit_sha: commit }; },
  };
}

const packet = await buildVercelVerificationEvidence({
  siteUrl: 'https://mirror-cartographer-ui.vercel.app',
  expectedCommit: sha,
  fetchImpl: async () => response(),
  now: () => new Date('2026-07-12T00:48:00.000Z'),
});
assert.equal(packet.status, 'verified');
assert.equal(packet.deployment.served_commit, sha);
assert.equal(packet.generated_at, '2026-07-12T00:48:00.000Z');
assert.equal(packet.limits.length, 3);

await assert.rejects(
  buildVercelVerificationEvidence({
    siteUrl: 'https://mirror-cartographer-ui.vercel.app',
    expectedCommit: sha,
    fetchImpl: async () => response({ commit: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd' }),
  }),
  /Deployment commit mismatch/,
);

await assert.rejects(
  buildVercelVerificationEvidence({
    siteUrl: 'https://mirror-cartographer-ui.vercel.app',
    expectedCommit: sha,
    fetchImpl: async () => response({ url: 'https://attacker.example/.well-known/mirror-cartographer-deployment.json' }),
  }),
  /not allowlisted/,
);

let out = '';
let err = '';
const success = await main({
  env: { SITE_URL: 'https://mirror-cartographer-ui.vercel.app', EXPECTED_COMMIT: sha },
  fetchImpl: async () => response(),
  stdout: { write(value) { out += value; } },
  stderr: { write(value) { err += value; } },
});
assert.equal(success, 0);
assert.equal(err, '');
assert.equal(JSON.parse(out).deployment.served_commit, sha);

out = '';
err = '';
const failure = await main({
  env: {},
  fetchImpl: async () => response(),
  stdout: { write(value) { out += value; } },
  stderr: { write(value) { err += value; } },
});
assert.equal(failure, 1);
assert.equal(out, '');
assert.match(err, /siteUrl is required/);

console.log('Vercel deployment evidence CLI: 5 assertions passed');
