import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { verifyRuntime } from './verify-runtime.mjs';

const ARTIFACT = `sha256:${'a'.repeat(64)}`;
async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); } finally { await new Promise(resolve => server.close(resolve)); }
}
function json(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  response.end(text);
}
function validHandler(request, response) {
  if (request.url === '/healthz') return json(response, 200, { schema: 'fia.runtime-health.v1', status: 'ok' });
  if (request.url === '/fia-artifact') return json(response, 200, { schema: 'fia.runtime-artifact.v1', artifact: ARTIFACT });
  response.writeHead(404).end();
}

test('verifies health and exact served artifact identity deterministically', async () => {
  await withServer(validHandler, async url => {
    const first = await verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 });
    const second = await verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 });
    assert.equal(first.artifact, ARTIFACT);
    assert.equal(first.health, 'ok');
    assert.equal(first.verification, second.verification);
  });
});

test('rejects a healthy runtime serving the wrong artifact', async () => {
  await withServer((request, response) => {
    if (request.url === '/healthz') return json(response, 200, { schema: 'fia.runtime-health.v1', status: 'ok' });
    if (request.url === '/fia-artifact') return json(response, 200, { schema: 'fia.runtime-artifact.v1', artifact: `sha256:${'b'.repeat(64)}` });
    response.writeHead(404).end();
  }, async url => assert.rejects(() => verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 }), /served artifact mismatch/));
});

test('rejects false health success and malformed endpoint schemas', async () => {
  await withServer((request, response) => {
    if (request.url === '/healthz') return json(response, 200, { status: 'ok' });
    return json(response, 200, { schema: 'fia.runtime-artifact.v1', artifact: ARTIFACT });
  }, async url => assert.rejects(() => verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 }), /health verification failed/));
});

test('rejects redirects so verification cannot drift to another host', async () => {
  await withServer((_request, response) => {
    response.writeHead(302, { location: 'https://example.com/' });
    response.end();
  }, async url => assert.rejects(() => verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 })));
});

test('fails closed on invalid JSON', async () => {
  await withServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
  }, async url => assert.rejects(() => verifyRuntime({ url, artifact: ARTIFACT, timeout: 1000 }), /invalid JSON/));
});

test('times out stalled runtimes', async () => {
  await withServer(() => {}, async url => assert.rejects(() => verifyRuntime({ url, artifact: ARTIFACT, timeout: 25 }), /timed out/));
});

test('rejects non-http URLs and malformed artifact identities before network access', async () => {
  await assert.rejects(() => verifyRuntime({ url: 'file:///tmp/site', artifact: ARTIFACT }), /http or https/);
  await assert.rejects(() => verifyRuntime({ url: 'http://127.0.0.1:1', artifact: 'latest' }), /artifact identity/);
});
