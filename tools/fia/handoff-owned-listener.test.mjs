import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { handoff } from './handoff-owned-listener.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const identity = record => sha(Buffer.from(JSON.stringify(canonical(record))));
function makeEvidence(base) { return { ...base, identity: identity(base) }; }
function supervision({ release, listener, pid = process.pid, port = 4001, content }) {
  return makeEvidence({ schema: 'fia.owned-listener-supervision.v1', releaseIdentity: release, executable: { sha256: sha('exe'), size: 3 }, process: { pid, processStartIdentity: { kind: 'pid-only', value: String(pid) }, listenerId: listener }, endpoint: { host: '127.0.0.1', port }, probe: { path: '/', status: 200, contentSha256: content, schema: 'fia.owned-static-runtime-server.v1' }, logs: {}, policy: {} });
}
function health(release, content) { return makeEvidence({ schema: 'fia.owned-runtime-health.v1', releaseIdentity: release, contentSha256: content, probes: [] }); }
const processIdentityImpl = async pid => ({ kind: 'pid-only', value: String(pid) });
function response(body, listenerId) { const digest = sha(body); return { status: 200, headers: { 'x-fia-content-sha256': digest, 'x-fia-listener-id': listenerId }, body: Buffer.from(body) }; }
async function fixture(withPrevious = true) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-handoff-'));
  const body = Buffer.from('candidate'); const oldBody = Buffer.from('previous');
  const candidate = supervision({ release: sha('release-new'), listener: sha('listener-new'), content: sha(body) });
  const previous = supervision({ release: sha('release-old'), listener: sha('listener-old'), port: 4000, content: sha(oldBody) });
  const h = health(candidate.releaseIdentity, candidate.probe.contentSha256);
  const request = { schema: 'fia.owned-listener-handoff-request.v1', publicHost: '127.0.0.1', publicPort: 8080, probePath: '/', timeoutMs: 1000, maxBytes: 1024 };
  for (const [name, value] of [['request.json', request], ['candidate.json', candidate], ['health.json', h]]) await writeFile(path.join(dir, name), JSON.stringify(value));
  if (withPrevious) {
    await writeFile(path.join(dir, 'previous.json'), JSON.stringify(previous));
    await writeFile(path.join(dir, 'route.json'), JSON.stringify({ schema: 'fia.owned-listener-route.v1', releaseIdentity: previous.releaseIdentity, listenerId: previous.process.listenerId, contentSha256: previous.probe.contentSha256, host: previous.endpoint.host, port: previous.endpoint.port }));
  }
  return { dir, body, oldBody, candidate, previous, request };
}

test('atomically switches route, verifies public bytes, then retires previous listener', async () => {
  const f = await fixture(); const signals = [];
  const probe = async () => response(f.body, f.candidate.process.listenerId);
  const evidence = await handoff({ requestPath: path.join(f.dir,'request.json'), candidatePath: path.join(f.dir,'candidate.json'), healthPath: path.join(f.dir,'health.json'), previousPath: path.join(f.dir,'previous.json'), routeStatePath: path.join(f.dir,'route.json'), outputPath: path.join(f.dir,'evidence.json'), probeImpl: probe, processIdentityImpl, signalImpl: (...args) => signals.push(args) });
  assert.equal(evidence.publicProbe.contentSha256, f.candidate.probe.contentSha256);
  assert.deepEqual(signals, [[-f.previous.process.pid, 'SIGTERM']]);
  const route = JSON.parse(await readFile(path.join(f.dir,'route.json')));
  assert.equal(route.listenerId, f.candidate.process.listenerId);
});

test('rejects candidate supervision identity substitution', async () => {
  const f = await fixture(); const bad = JSON.parse(await readFile(path.join(f.dir,'candidate.json'))); bad.releaseIdentity = sha('changed'); await writeFile(path.join(f.dir,'candidate.json'), JSON.stringify(bad));
  await assert.rejects(() => handoff({ requestPath:path.join(f.dir,'request.json'), candidatePath:path.join(f.dir,'candidate.json'), healthPath:path.join(f.dir,'health.json'), previousPath:path.join(f.dir,'previous.json'), routeStatePath:path.join(f.dir,'route.json'), outputPath:path.join(f.dir,'out.json'), probeImpl:async()=>response(f.body,f.candidate.process.listenerId), processIdentityImpl }), /identity mismatch/);
});

test('rejects public listener identity mismatch and restores previous route', async () => {
  const f = await fixture(); let calls = 0;
  const probe = async ({ port }) => { calls++; if (port === 8080 && calls === 2) return response(f.body, sha('wrong-listener')); if (port === 8080) return response(f.oldBody, f.previous.process.listenerId); return response(f.body, f.candidate.process.listenerId); };
  await assert.rejects(() => handoff({ requestPath:path.join(f.dir,'request.json'), candidatePath:path.join(f.dir,'candidate.json'), healthPath:path.join(f.dir,'health.json'), previousPath:path.join(f.dir,'previous.json'), routeStatePath:path.join(f.dir,'route.json'), outputPath:path.join(f.dir,'out.json'), probeImpl:probe, processIdentityImpl }), /public probe listener identity mismatch/);
  const route = JSON.parse(await readFile(path.join(f.dir,'route.json')));
  assert.equal(route.listenerId, f.previous.process.listenerId);
});

test('rejects stale route state before switch', async () => {
  const f = await fixture(); const route = JSON.parse(await readFile(path.join(f.dir,'route.json'))); route.listenerId = sha('stale'); await writeFile(path.join(f.dir,'route.json'), JSON.stringify(route));
  await assert.rejects(() => handoff({ requestPath:path.join(f.dir,'request.json'), candidatePath:path.join(f.dir,'candidate.json'), healthPath:path.join(f.dir,'health.json'), previousPath:path.join(f.dir,'previous.json'), routeStatePath:path.join(f.dir,'route.json'), outputPath:path.join(f.dir,'out.json'), probeImpl:async()=>response(f.body,f.candidate.process.listenerId), processIdentityImpl }), /route state does not match/);
});

test('post-switch failure restores and publicly verifies previous listener', async () => {
  const f = await fixture();
  const probe = async ({ port }) => port === 8080 ? response(f.oldBody, f.previous.process.listenerId) : response(f.body, f.candidate.process.listenerId);
  await assert.rejects(() => handoff({ requestPath:path.join(f.dir,'request.json'), candidatePath:path.join(f.dir,'candidate.json'), healthPath:path.join(f.dir,'health.json'), previousPath:path.join(f.dir,'previous.json'), routeStatePath:path.join(f.dir,'route.json'), outputPath:path.join(f.dir,'out.json'), probeImpl:probe, processIdentityImpl, injectFailure:'after-switch' }), /injected failure/);
  const route = JSON.parse(await readFile(path.join(f.dir,'route.json')));
  assert.equal(route.listenerId, f.previous.process.listenerId);
});

test('refuses to overwrite retained evidence before changing route state', async () => {
  const f = await fixture(); await writeFile(path.join(f.dir,'out.json'),'keep');
  const before = await readFile(path.join(f.dir,'route.json'),'utf8');
  const probe = async () => response(f.body, f.candidate.process.listenerId);
  await assert.rejects(() => handoff({ requestPath:path.join(f.dir,'request.json'), candidatePath:path.join(f.dir,'candidate.json'), healthPath:path.join(f.dir,'health.json'), previousPath:path.join(f.dir,'previous.json'), routeStatePath:path.join(f.dir,'route.json'), outputPath:path.join(f.dir,'out.json'), probeImpl:probe, processIdentityImpl, signalImpl:()=>{} }), /refusing to overwrite/);
  assert.equal(await readFile(path.join(f.dir,'out.json'),'utf8'),'keep');
  assert.equal(await readFile(path.join(f.dir,'route.json'),'utf8'), before);
});
