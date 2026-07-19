#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rename, rm, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const REQUEST_SCHEMA = 'fia.owned-listener-supervision-request.v1';
const EVIDENCE_SCHEMA = 'fia.owned-listener-supervision.v1';
const SERVER_SCHEMA = 'fia.owned-static-runtime-server.v1';
const MAX_LOG_BYTES = 4 * 1024 * 1024;

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
function validateRequest(request) {
  if (request?.schema !== REQUEST_SCHEMA) fail(`expected ${REQUEST_SCHEMA}`);
  requireSha(request.releaseIdentity, 'releaseIdentity');
  if (!Array.isArray(request.command) || request.command.length < 1 || request.command.some(v => typeof v !== 'string' || !v)) fail('command must be a non-empty string array');
  if (!path.isAbsolute(request.command[0])) fail('command executable must be absolute');
  if (request.cwd !== undefined && !path.isAbsolute(request.cwd)) fail('cwd must be absolute when provided');
  if (!request.probe || typeof request.probe.path !== 'string' || !request.probe.path.startsWith('/')) fail('probe.path must be an absolute URL path');
  if (request.probe.path.includes('..') || request.probe.path.includes('\\') || request.probe.path.includes('?') || request.probe.path.includes('#')) fail('probe.path is unsafe');
  requireSha(request.probe.contentSha256, 'probe.contentSha256');
  if (request.probe.schema !== SERVER_SCHEMA) fail(`probe.schema must be ${SERVER_SCHEMA}`);
  const startupTimeoutMs = request.startupTimeoutMs ?? 10000;
  const probeTimeoutMs = request.probeTimeoutMs ?? 5000;
  const shutdownTimeoutMs = request.shutdownTimeoutMs ?? 5000;
  for (const [label, value] of Object.entries({ startupTimeoutMs, probeTimeoutMs, shutdownTimeoutMs })) {
    if (!Number.isInteger(value) || value < 100 || value > 600000) fail(`${label} out of range`);
  }
  return canonical({ ...request, startupTimeoutMs, probeTimeoutMs, shutdownTimeoutMs });
}
async function writeExclusiveAtomic(file, payload) {
  await mkdir(path.dirname(file), { recursive: true });
  try { await lstat(file); fail(`refusing to overwrite ${file}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  await writeFile(tmp, payload, { flag: 'wx', mode: 0o600 });
  try { await rename(tmp, file); } catch (e) { await rm(tmp, { force: true }); throw e; }
}
function boundedCollector(stream, limit = MAX_LOG_BYTES) {
  const chunks = [];
  let total = 0;
  let truncated = false;
  stream.on('data', chunk => {
    const remaining = limit - total;
    if (remaining > 0) {
      const slice = chunk.subarray(0, remaining);
      chunks.push(slice);
      total += slice.length;
    }
    if (chunk.length > remaining) truncated = true;
  });
  return () => ({ bytes: Buffer.concat(chunks), truncated });
}
async function executableIdentity(executable) {
  const resolved = await realpath(executable);
  const bytes = await readFile(resolved);
  return { sha256: sha256(bytes), size: bytes.length };
}
async function processStartIdentity(pid) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    const fields = stat.slice(close + 2).split(' ');
    return { kind: 'linux-proc-start-ticks', value: fields[19] };
  } catch {
    return { kind: 'pid-only', value: String(pid) };
  }
}
function readStartupLine(stream, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => cleanup(new Error('startup announcement timeout')), timeoutMs);
    function cleanup(error, value) {
      clearTimeout(timer); stream.off('data', onData); stream.off('end', onEnd);
      error ? reject(error) : resolve(value);
    }
    function onEnd() { cleanup(new Error('listener exited before startup announcement')); }
    function onData(chunk) {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      try { cleanup(null, JSON.parse(buffer.slice(0, newline))); }
      catch { cleanup(new Error('invalid startup announcement JSON')); }
    }
    stream.on('data', onData); stream.on('end', onEnd);
  });
}
function probeHttp({ host, port, path: requestPath, timeoutMs, maxBytes = 16 * 1024 * 1024 }) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host, port, path: requestPath, method: 'GET', headers: { Accept: 'text/html,*/*;q=0.8' } }, response => {
      const chunks = []; let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) { request.destroy(new Error('probe response exceeds maximum bytes')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('probe timeout')));
    request.on('error', reject); request.end();
  });
}
async function terminate(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    await new Promise(resolve => child.once('exit', resolve));
  }
}

export async function supervise({ requestPath, outputPath, stopAfterProbe = false, spawnImpl = spawn, probeImpl = probeHttp }) {
  const requestFileBytes = await readFile(requestPath);
  const request = validateRequest(JSON.parse(requestFileBytes));
  const executable = await executableIdentity(request.command[0]);
  const env = { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC', HOME: request.cwd ?? process.cwd(), TMPDIR: request.cwd ?? process.cwd() };
  const child = spawnImpl(request.command[0], request.command.slice(1), { cwd: request.cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const stdoutResult = boundedCollector(child.stdout);
  const stderrResult = boundedCollector(child.stderr);
  let startup;
  try {
    startup = await readStartupLine(child.stdout, request.startupTimeoutMs);
    if (startup.schema !== SERVER_SCHEMA) fail(`startup schema must be ${SERVER_SCHEMA}`);
    if (startup.host !== '127.0.0.1' && startup.host !== '::1') fail('startup host must be loopback');
    if (!Number.isInteger(startup.port) || startup.port < 1 || startup.port > 65535) fail('startup port invalid');
    if (child.exitCode !== null) fail('listener exited before probe');
    const probe = await probeImpl({ host: startup.host, port: startup.port, path: request.probe.path, timeoutMs: request.probeTimeoutMs });
    if (probe.status !== 200) fail(`probe status ${probe.status}`);
    const actualSha256 = sha256(probe.body);
    if (actualSha256 !== request.probe.contentSha256) fail('served content digest mismatch');
    if (probe.headers['x-fia-content-sha256'] !== actualSha256) fail('served digest header mismatch');
    if (probe.headers['x-fia-schema'] !== request.probe.schema) fail('served schema header mismatch');
    const startIdentity = await processStartIdentity(child.pid);
    const listenerBase = canonical({ executable, processStartIdentity: startIdentity, host: startup.host, port: startup.port, releaseIdentity: request.releaseIdentity, contentSha256: actualSha256 });
    const listenerId = sha256(stableBytes(listenerBase));
    const stdout = stdoutResult(); const stderr = stderrResult();
    const evidenceBase = canonical({
      schema: EVIDENCE_SCHEMA,
      requestIdentity: sha256(stableBytes(request)),
      requestFileSha256: sha256(requestFileBytes),
      releaseIdentity: request.releaseIdentity,
      executable,
      process: { pid: child.pid, processStartIdentity: startIdentity, listenerId },
      endpoint: { host: startup.host, port: startup.port },
      probe: { path: request.probe.path, status: probe.status, contentSha256: actualSha256, schema: probe.headers['x-fia-schema'] },
      logs: { stdoutSha256: sha256(stdout.bytes), stdoutBytes: stdout.bytes.length, stdoutTruncated: stdout.truncated, stderrSha256: sha256(stderr.bytes), stderrBytes: stderr.bytes.length, stderrTruncated: stderr.truncated },
      policy: { loopbackOnly: true, sanitizedEnvironment: true, boundedLogs: true, processGroupTermination: true, startupTimeoutMs: request.startupTimeoutMs, probeTimeoutMs: request.probeTimeoutMs, shutdownTimeoutMs: request.shutdownTimeoutMs }
    });
    const evidence = { ...evidenceBase, identity: sha256(stableBytes(evidenceBase)) };
    await writeExclusiveAtomic(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    if (stopAfterProbe) await terminate(child, request.shutdownTimeoutMs);
    return { evidence, child };
  } catch (error) {
    await terminate(child, request.shutdownTimeoutMs);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  if (!args.request || !args.output) fail('usage: --request <json> --output <json>');
  supervise({ requestPath: args.request, outputPath: args.output })
    .then(({ evidence, child }) => {
      process.stdout.write(`${JSON.stringify({ schema: evidence.schema, identity: evidence.identity, listenerId: evidence.process.listenerId, pid: child.pid })}\n`);
      const shutdown = async () => { await terminate(child, evidence.policy.shutdownTimeoutMs); process.exit(0); };
      process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
      child.once('exit', (code, signal) => { process.stderr.write(`owned listener exited code=${code} signal=${signal}\n`); process.exitCode = code === 0 ? 0 : 1; });
    })
    .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
