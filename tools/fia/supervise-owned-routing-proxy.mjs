#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, open, readFile, realpath } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const SCHEMA = 'fia.owned-routing-proxy-supervision.v1';
const STARTUP_SCHEMA = 'fia.owned-routing-proxy-state.v1';
const MAX_LOG_BYTES = 4 * 1024 * 1024;

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = value;
  }
  return out;
}
function requireExactObject(obj, keys, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(obj).sort(); const expected = [...keys].sort();
  if (canonical(actual) !== canonical(expected)) throw new Error(`${label} fields mismatch`);
}
async function processStartTicks(pid) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const end = stat.lastIndexOf(')');
    const fields = stat.slice(end + 2).trim().split(/\s+/);
    return fields[19] ?? null;
  } catch { return null; }
}
function boundedCollector(stream) {
  const chunks = []; let size = 0; let truncated = false;
  stream.on('data', chunk => {
    if (size >= MAX_LOG_BYTES) { truncated = true; return; }
    const remain = MAX_LOG_BYTES - size;
    chunks.push(chunk.subarray(0, remain)); size += Math.min(chunk.length, remain);
    if (chunk.length > remain) truncated = true;
  });
  return () => { const bytes = Buffer.concat(chunks); return { size: bytes.length, sha256: sha256(bytes), truncated }; };
}
function probe(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { accept: 'text/plain', 'cache-control': 'no-cache' } }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size <= 1024 * 1024) chunks.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('probe timeout')));
    req.on('error', reject);
  });
}
async function killGroup(child) {
  if (!child || child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  await new Promise(resolve => setTimeout(resolve, 100));
  if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
}
async function main() {
  const args = parseArgs(process.argv);
  for (const key of ['request', 'output']) if (!args[key]) throw new Error(`missing --${key}`);
  try { await access(args.output); throw new Error('output already exists'); } catch (error) { if (error.message === 'output already exists') throw error; }
  const requestBytes = await readFile(args.request);
  const request = JSON.parse(requestBytes);
  requireExactObject(request, ['schema','command','args','host','port','probePath','timeoutMs','restartLimit','releaseIdentity','routeIdentity'], 'request');
  if (request.schema !== 'fia.owned-routing-proxy-supervision-request.v1') throw new Error('unsupported request schema');
  if (!path.isAbsolute(request.command)) throw new Error('command must be absolute');
  if (!Array.isArray(request.args) || request.args.some(value => typeof value !== 'string')) throw new Error('args must be strings');
  if (!['127.0.0.1','::1'].includes(request.host)) throw new Error('host must be loopback');
  if (!Number.isInteger(request.port) || request.port < 1 || request.port > 65535) throw new Error('invalid port');
  if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 100 || request.timeoutMs > 60000) throw new Error('invalid timeoutMs');
  if (!Number.isInteger(request.restartLimit) || request.restartLimit < 0 || request.restartLimit > 10) throw new Error('invalid restartLimit');
  for (const key of ['releaseIdentity','routeIdentity']) if (!/^[a-f0-9]{64}$/.test(request[key])) throw new Error(`${key} must be sha256`);

  const command = await realpath(request.command);
  const executable = await readFile(command);
  const executableSha256 = sha256(executable);
  const attempts = [];
  let child;
  let success = false;
  let finalStartup;
  try {
    for (let attempt = 0; attempt <= request.restartLimit; attempt++) {
      child = spawn(command, request.args, { detached: true, stdio: ['ignore','pipe','pipe'], env: { PATH: process.env.PATH ?? '', LANG:'C.UTF-8', LC_ALL:'C.UTF-8', TZ:'UTC', HOME:'/', TMPDIR:'/tmp' } });
      const getOut = boundedCollector(child.stdout); const getErr = boundedCollector(child.stderr);
      const startTicks = await processStartTicks(child.pid);
      const startup = await new Promise((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(() => reject(new Error('startup timeout')), request.timeoutMs);
        child.stdout.on('data', chunk => {
          buffer += chunk.toString('utf8');
          const newline = buffer.indexOf('\n');
          if (newline >= 0) {
            clearTimeout(timer);
            try { resolve(JSON.parse(buffer.slice(0, newline))); } catch { reject(new Error('invalid startup evidence')); }
          }
        });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`proxy exited during startup: ${code}`)); });
      });
      requireExactObject(startup, ['schema','host','port','proxyIdentity'], 'startup');
      if (startup.schema !== STARTUP_SCHEMA || startup.host !== request.host || startup.port !== request.port) throw new Error('startup identity mismatch');
      if (!/^[a-f0-9]{64}$/.test(startup.proxyIdentity)) throw new Error('invalid proxy identity');
      const response = await probe(`http://${request.host}:${request.port}${request.probePath}`, request.timeoutMs);
      const bodySha256 = sha256(response.body);
      const routeHeader = response.headers['x-fia-route-identity'];
      const proxyHeader = response.headers['x-fia-proxy-identity'];
      const accepted = response.status === 200 && routeHeader === request.routeIdentity && proxyHeader === startup.proxyIdentity;
      const stdout = getOut(); const stderr = getErr();
      attempts.push({ attempt: attempt + 1, pid: child.pid, processStartTicks: startTicks, startup, probe: { status: response.status, bodySha256, routeIdentity: routeHeader ?? null, proxyIdentity: proxyHeader ?? null }, stdout, stderr, accepted });
      if (accepted) { success = true; finalStartup = startup; break; }
      await killGroup(child);
    }
    if (!success) throw new Error('proxy supervision exhausted restart policy');
    const policy = { restartLimit: request.restartLimit, timeoutMs: request.timeoutMs, loopbackOnly: true, exactExecutable: true };
    const identityMaterial = { schema: SCHEMA, requestSha256: sha256(requestBytes), executableSha256, releaseIdentity: request.releaseIdentity, routeIdentity: request.routeIdentity, proxyIdentity: finalStartup.proxyIdentity, policy };
    const processStart = await processStartTicks(child.pid);
    const evidence = { schema: SCHEMA, identity: sha256(Buffer.from(canonical(identityMaterial))), requestSha256: sha256(requestBytes), executable: { path: command, size: executable.length, sha256: executableSha256 }, releaseIdentity: request.releaseIdentity, routeIdentity: request.routeIdentity, proxyIdentity: finalStartup.proxyIdentity, activeProcess: { pid: child.pid, processStartTicks: processStart, identityStrength: processStart ? 'pid-start-ticks' : 'pid-only' }, attempts, policy };
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
    const handle = await open(args.output, 'wx');
    await handle.writeFile(`${JSON.stringify(evidence, null, 2)}\n`); await handle.sync(); await handle.close();
    process.stdout.write(`${JSON.stringify({ schema: SCHEMA, identity: evidence.identity, pid: child.pid })}\n`);
  } catch (error) {
    await killGroup(child);
    throw error;
  }
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
