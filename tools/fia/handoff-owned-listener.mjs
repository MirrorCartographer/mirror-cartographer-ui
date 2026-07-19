#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir, rename, rm, lstat } from 'node:fs/promises';

const REQUEST_SCHEMA = 'fia.owned-listener-handoff-request.v1';
const SUPERVISION_SCHEMA = 'fia.owned-listener-supervision.v1';
const HEALTH_SCHEMA = 'fia.owned-runtime-health.v1';
const EVIDENCE_SCHEMA = 'fia.owned-listener-handoff.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function stableBytes(value) { return Buffer.from(JSON.stringify(canonical(value))); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${argv[i] ?? '<end>'}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
function requireSha(value, label) { if (!/^[a-f0-9]{64}$/.test(value ?? '')) fail(`${label} must be sha256`); }
function verifyIdentity(record, label) {
  if (!record || typeof record !== 'object') fail(`${label} must be an object`);
  requireSha(record.identity, `${label}.identity`);
  const { identity, ...base } = record;
  const actual = sha256(stableBytes(base));
  if (actual !== identity) fail(`${label} identity mismatch`);
}
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeExclusiveAtomic(file, payload) {
  await mkdir(path.dirname(file), { recursive: true });
  try { await lstat(file); fail(`refusing to overwrite ${file}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  await writeFile(tmp, payload, { flag: 'wx', mode: 0o600 });
  try { await rename(tmp, file); } catch (error) { await rm(tmp, { force: true }); throw error; }
}
async function replaceAtomic(file, payload) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  await writeFile(tmp, payload, { flag: 'wx', mode: 0o600 });
  try { await rename(tmp, file); } catch (error) { await rm(tmp, { force: true }); throw error; }
}
function validateSupervision(record, label) {
  if (record.schema !== SUPERVISION_SCHEMA) fail(`${label} must be ${SUPERVISION_SCHEMA}`);
  verifyIdentity(record, label);
  requireSha(record.releaseIdentity, `${label}.releaseIdentity`);
  requireSha(record.process?.listenerId, `${label}.process.listenerId`);
  requireSha(record.probe?.contentSha256, `${label}.probe.contentSha256`);
  if (!Number.isInteger(record.process?.pid) || record.process.pid < 1) fail(`${label}.process.pid invalid`);
  if (!record.process?.processStartIdentity?.kind || !record.process?.processStartIdentity?.value) fail(`${label}.processStartIdentity missing`);
  if (record.endpoint?.host !== '127.0.0.1' && record.endpoint?.host !== '::1') fail(`${label}.endpoint must be loopback`);
  if (!Number.isInteger(record.endpoint?.port) || record.endpoint.port < 1 || record.endpoint.port > 65535) fail(`${label}.endpoint.port invalid`);
}
function validateHealth(record, label) {
  if (record.schema !== HEALTH_SCHEMA) fail(`${label} must be ${HEALTH_SCHEMA}`);
  verifyIdentity(record, label);
}
function healthBindsCandidate(health, candidate) {
  const serialized = JSON.stringify(health);
  if (!serialized.includes(candidate.releaseIdentity)) fail('health evidence does not bind candidate release');
  if (!serialized.includes(candidate.probe.contentSha256)) fail('health evidence does not bind candidate content');
}
async function processIdentity(pid) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    const fields = stat.slice(close + 2).split(' ');
    return { kind: 'linux-proc-start-ticks', value: fields[19] };
  } catch {
    try { process.kill(pid, 0); return { kind: 'pid-only', value: String(pid) }; }
    catch { return null; }
  }
}
async function assertProcessLive(supervision, label, identityImpl = processIdentity) {
  const actual = await identityImpl(supervision.process.pid);
  if (!actual) fail(`${label} process is not live`);
  const expected = supervision.process.processStartIdentity;
  if (actual.kind !== expected.kind || actual.value !== expected.value) fail(`${label} process identity changed`);
}
function probeHttp({ host, port, requestPath, timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host, port, path: requestPath, method: 'GET', headers: { Accept: 'text/html,*/*;q=0.8', 'Cache-Control': 'no-cache' } }, response => {
      const chunks = []; let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) { request.destroy(new Error('response exceeds maximum bytes')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('probe timeout')));
    request.on('error', reject); request.end();
  });
}
function verifyProbe(probe, candidate, label) {
  if (probe.status !== 200) fail(`${label} status ${probe.status}`);
  const digest = sha256(probe.body);
  if (digest !== candidate.probe.contentSha256) fail(`${label} content mismatch`);
  if (probe.headers['x-fia-content-sha256'] !== digest) fail(`${label} digest header mismatch`);
  if (probe.headers['x-fia-listener-id'] !== candidate.process.listenerId) fail(`${label} listener identity mismatch`);
  return { status: probe.status, contentSha256: digest, listenerId: probe.headers['x-fia-listener-id'] };
}
async function terminateProcessGroup(supervision, signalImpl = process.kill) {
  try { signalImpl(-supervision.process.pid, 'SIGTERM'); } catch {}
}

export async function handoff({ requestPath, candidatePath, healthPath, previousPath, routeStatePath, outputPath, probeImpl = probeHttp, signalImpl = process.kill, processIdentityImpl = processIdentity, injectFailure = '' }) {
  const requestBytes = await readFile(requestPath);
  const request = JSON.parse(requestBytes);
  if (request.schema !== REQUEST_SCHEMA) fail(`expected ${REQUEST_SCHEMA}`);
  const timeoutMs = request.timeoutMs ?? 5000;
  const maxBytes = request.maxBytes ?? 16 * 1024 * 1024;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600000) fail('timeoutMs out of range');
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 256 * 1024 * 1024) fail('maxBytes out of range');
  if (typeof request.publicHost !== 'string' || !request.publicHost) fail('publicHost required');
  if (!Number.isInteger(request.publicPort) || request.publicPort < 1 || request.publicPort > 65535) fail('publicPort invalid');
  if (typeof request.probePath !== 'string' || !request.probePath.startsWith('/') || request.probePath.includes('..') || request.probePath.includes('\\')) fail('probePath unsafe');

  try { await lstat(outputPath); fail(`refusing to overwrite ${outputPath}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const candidate = await readJson(candidatePath);
  const health = await readJson(healthPath);
  const previous = previousPath ? await readJson(previousPath) : null;
  validateSupervision(candidate, 'candidate');
  validateHealth(health, 'health');
  if (previous) validateSupervision(previous, 'previous');
  healthBindsCandidate(health, candidate);
  if (previous && previous.process.listenerId === candidate.process.listenerId) fail('candidate listener must differ from previous');
  await assertProcessLive(candidate, 'candidate', processIdentityImpl);

  const privateProbeRaw = await probeImpl({ host: candidate.endpoint.host, port: candidate.endpoint.port, requestPath: request.probePath, timeoutMs, maxBytes });
  const privateProbe = verifyProbe(privateProbeRaw, candidate, 'private probe');
  await assertProcessLive(candidate, 'candidate after private probe', processIdentityImpl);

  let existingRoute = null;
  try { existingRoute = await readJson(routeStatePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    if (!existingRoute) fail('previous listener declared but route state is absent');
    if (existingRoute.listenerId !== previous.process.listenerId || existingRoute.releaseIdentity !== previous.releaseIdentity || existingRoute.host !== previous.endpoint.host || existingRoute.port !== previous.endpoint.port) fail('route state does not match previous listener');
    await assertProcessLive(previous, 'previous', processIdentityImpl);
  } else if (existingRoute) fail('route state exists but no previous listener declared');

  const routeCandidate = canonical({ schema: 'fia.owned-listener-route.v1', releaseIdentity: candidate.releaseIdentity, listenerId: candidate.process.listenerId, contentSha256: candidate.probe.contentSha256, host: candidate.endpoint.host, port: candidate.endpoint.port });
  let switched = false;
  try {
    await replaceAtomic(routeStatePath, `${JSON.stringify(routeCandidate, null, 2)}\n`);
    switched = true;
    if (injectFailure === 'after-switch') fail('injected failure after switch');
    await assertProcessLive(candidate, 'candidate after switch', processIdentityImpl);
    const publicProbeRaw = await probeImpl({ host: request.publicHost, port: request.publicPort, requestPath: request.probePath, timeoutMs, maxBytes });
    const publicProbe = verifyProbe(publicProbeRaw, candidate, 'public probe');
    if (injectFailure === 'after-public-probe') fail('injected failure after public probe');
    if (previous) await terminateProcessGroup(previous, signalImpl);

    const evidenceBase = canonical({
      schema: EVIDENCE_SCHEMA,
      requestIdentity: sha256(stableBytes(canonical({ ...request, timeoutMs, maxBytes }))),
      requestFileSha256: sha256(requestBytes),
      candidate: { evidenceIdentity: candidate.identity, releaseIdentity: candidate.releaseIdentity, listenerId: candidate.process.listenerId, processStartIdentity: candidate.process.processStartIdentity, endpoint: candidate.endpoint, contentSha256: candidate.probe.contentSha256 },
      healthIdentity: health.identity,
      previous: previous ? { evidenceIdentity: previous.identity, releaseIdentity: previous.releaseIdentity, listenerId: previous.process.listenerId, processStartIdentity: previous.process.processStartIdentity, endpoint: previous.endpoint, contentSha256: previous.probe.contentSha256 } : null,
      route: routeCandidate,
      privateProbe,
      publicProbe,
      supersededListenerTerminated: Boolean(previous),
      rollbackPerformed: false,
      policy: { candidateRevalidatedBeforeAndAfterSwitch: true, atomicRouteReplace: true, publicByteVerification: true, listenerIdentityHeaderRequired: true, previousRetainedUntilPublicVerification: true, rollbackRequired: true, timeoutMs, maxBytes }
    });
    const evidence = { ...evidenceBase, identity: sha256(stableBytes(evidenceBase)) };
    await writeExclusiveAtomic(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    return evidence;
  } catch (error) {
    if (switched) {
      if (previous) {
        const restored = canonical({ schema: 'fia.owned-listener-route.v1', releaseIdentity: previous.releaseIdentity, listenerId: previous.process.listenerId, contentSha256: previous.probe.contentSha256, host: previous.endpoint.host, port: previous.endpoint.port });
        await replaceAtomic(routeStatePath, `${JSON.stringify(restored, null, 2)}\n`);
        await assertProcessLive(previous, 'previous after rollback', processIdentityImpl);
        const rollbackProbeRaw = await probeImpl({ host: request.publicHost, port: request.publicPort, requestPath: request.probePath, timeoutMs, maxBytes });
        verifyProbe(rollbackProbeRaw, previous, 'rollback public probe');
      } else {
        await rm(routeStatePath, { force: true });
      }
    }
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  if (!args.request || !args.candidate || !args.health || !args.routeState || !args.output) fail('usage: --request <json> --candidate <json> --health <json> [--previous <json>] --routeState <json> --output <json>');
  handoff({ requestPath: args.request, candidatePath: args.candidate, healthPath: args.health, previousPath: args.previous, routeStatePath: args.routeState, outputPath: args.output })
    .then(evidence => process.stdout.write(`${JSON.stringify({ schema: evidence.schema, identity: evidence.identity, listenerId: evidence.candidate.listenerId })}\n`))
    .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
