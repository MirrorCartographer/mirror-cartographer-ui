#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.self-hosted-worker-run.v1';
const DEFAULT_ENV_ALLOWLIST = ['LANG', 'LC_ALL', 'TZ'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const stable = (value) => JSON.stringify(canonical(value));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fail(message) { throw new Error(message); }
function parseJson(value, label) { try { return JSON.parse(value); } catch { fail(`${label} is not valid JSON`); } }
function parseArgs(argv) {
  const out = { timeoutMs: '900000', networkMode: process.platform === 'linux' ? 'namespace' : 'disabled-env' };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[key.slice(2)] = value;
  }
  for (const key of ['source', 'command', 'output']) if (!out[key]) fail(`missing --${key}`);
  const command = parseJson(out.command, '--command');
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !part)) fail('--command must be a non-empty JSON string array');
  const timeoutMs = Number(out.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 86_400_000) fail('--timeoutMs must be an integer from 100 through 86400000');
  const envAllowlist = out.envAllowlist ? parseJson(out.envAllowlist, '--envAllowlist') : DEFAULT_ENV_ALLOWLIST;
  if (!Array.isArray(envAllowlist) || envAllowlist.some((name) => typeof name !== 'string' || !/^[A-Z_][A-Z0-9_]*$/i.test(name))) fail('--envAllowlist must be a JSON string array of environment variable names');
  if (!['namespace', 'disabled-env'].includes(out.networkMode)) fail('--networkMode must be namespace or disabled-env');
  return { ...out, command, timeoutMs, envAllowlist: [...new Set(envAllowlist)].sort() };
}
async function ensureAbsent(target) {
  try { await stat(target); fail(`destination already exists: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function inventory(root, label) {
  const entries = [];
  async function walk(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name); const relative = path.posix.join(prefix, name); const info = await lstat(absolute);
      if (info.isSymbolicLink()) fail(`symlink is not allowed in ${label}: ${relative}`);
      if (info.isDirectory()) { entries.push({ path: `${relative}/`, type: 'directory', mode: info.mode & 0o777 }); await walk(absolute, relative); }
      else if (info.isFile()) { const bytes = await readFile(absolute); entries.push({ path: relative, type: 'file', mode: info.mode & 0o777, bytes: bytes.length, sha256: sha256(bytes) }); }
      else fail(`unsupported filesystem entry in ${label}: ${relative}`);
    }
  }
  await walk(root);
  return entries;
}
function hasUnshare() {
  if (process.platform !== 'linux') return false;
  const result = spawnSync('unshare', ['--user', '--map-root-user', '--net', 'true'], { stdio: 'ignore' });
  return result.status === 0;
}
function sanitizedEnvironment(workspace, allowlist) {
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: path.join(workspace, '.home'),
    TMPDIR: path.join(workspace, '.tmp'),
    TEMP: path.join(workspace, '.tmp'),
    TMP: path.join(workspace, '.tmp'),
    FIA_WORKSPACE: workspace,
    FIA_NETWORK_POLICY: 'disabled',
    HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9',
    http_proxy: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9', all_proxy: 'http://127.0.0.1:9',
    NO_PROXY: '', no_proxy: '',
  };
  for (const name of allowlist) if (process.env[name] !== undefined) env[name] = process.env[name];
  return env;
}
function runProcess(command, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: options.cwd, env: options.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = []; let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    }, options.timeoutMs);
    child.stdout.on('data', (chunk) => stdout.push(chunk)); child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}
async function commandEvidence(command) {
  const resolved = command[0].includes(path.sep) ? path.resolve(command[0]) : null;
  let executableIdentity = null;
  if (resolved) {
    try { const bytes = await readFile(resolved); executableIdentity = { bytes: bytes.length, sha256: sha256(bytes) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { executable: path.basename(command[0]), executableIdentity, args: command.slice(1) };
}

export async function runSelfHostedWorker(options) {
  const source = path.resolve(options.source); const output = path.resolve(options.output);
  const command = options.command; const timeoutMs = Number(options.timeoutMs ?? 900000);
  const envAllowlist = [...new Set(options.envAllowlist ?? DEFAULT_ENV_ALLOWLIST)].sort();
  const requestedNetworkMode = options.networkMode ?? (process.platform === 'linux' ? 'namespace' : 'disabled-env');
  if (!Array.isArray(command) || command.length === 0) fail('command must be a non-empty array');
  await ensureAbsent(output);
  const root = await mkdtemp(path.join(tmpdir(), 'fia-worker-')); const workspace = path.join(root, 'workspace');
  try {
    await cp(source, workspace, { recursive: true, dereference: false });
    await mkdir(path.join(workspace, '.home'), { recursive: true }); await mkdir(path.join(workspace, '.tmp'), { recursive: true });
    const before = await inventory(workspace, 'worker input'); const beforeIdentity = sha256(Buffer.from(stable(before)));
    const namespaceAvailable = hasUnshare();
    if (requestedNetworkMode === 'namespace' && !namespaceAvailable) fail('kernel network namespace isolation is unavailable');
    const effectiveCommand = requestedNetworkMode === 'namespace'
      ? ['unshare', '--user', '--map-root-user', '--net', '--mount-proc', '--', ...command]
      : command;
    const env = sanitizedEnvironment(workspace, envAllowlist);
    const result = await runProcess(effectiveCommand, { cwd: workspace, env, timeoutMs });
    const after = await inventory(workspace, 'worker output'); const afterIdentity = sha256(Buffer.from(stable(after)));
    const record = {
      schema: SCHEMA,
      policy: {
        workspace: 'disposable-copy', environment: 'allowlist', timeoutMs,
        processTermination: 'process-group-sigkill', symlinks: 'reject', retainedLogs: 'sha256',
        network: requestedNetworkMode === 'namespace' ? 'linux-user-and-network-namespace' : 'environment-denial-not-kernel-enforced',
      },
      isolation: { requestedNetworkMode, namespaceAvailable, kernelEnforced: requestedNetworkMode === 'namespace' },
      command: await commandEvidence(command), envAllowlist,
      input: { identity: beforeIdentity, inventory: before },
      output: { identity: afterIdentity, inventory: after },
      execution: {
        exitCode: result.code, signal: result.signal, timedOut: result.timedOut,
        stdout: { bytes: result.stdout.length, sha256: sha256(result.stdout) },
        stderr: { bytes: result.stderr.length, sha256: sha256(result.stderr) },
      },
      status: result.timedOut ? 'timed-out' : result.code === 0 ? 'succeeded' : 'failed',
    };
    record.identity = sha256(Buffer.from(stable(record)));
    await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    if (result.timedOut) fail(`worker timed out after ${timeoutMs}ms`);
    if (result.code !== 0) fail(`worker command failed with exit code ${result.code}`);
    return record;
  } finally { await rm(root, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSelfHostedWorker(parseArgs(process.argv))
    .then((record) => process.stdout.write(`${record.identity}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
