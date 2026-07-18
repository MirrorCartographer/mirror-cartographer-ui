#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SPEC_SCHEMA = 'fia.private-root-worker-spec.v1';
const RUN_SCHEMA = 'fia.private-root-worker-run.v1';
const LOG_LIMIT = 4 * 1024 * 1024;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const stable = value => JSON.stringify(canonical(value));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

async function ensureAbsent(file) {
  try { await stat(file); fail(`destination already exists: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function parseJson(name, value) { try { return JSON.parse(value); } catch { fail(`invalid JSON for --${name}`); } }
function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) fail('arguments must be --name value pairs');
    values[argv[index].slice(2)] = argv[index + 1];
  }
  for (const name of ['spec', 'hostRefs', 'output']) if (!values[name]) fail(`missing --${name}`);
  return {
    spec: values.spec,
    hostRefs: parseJson('hostRefs', values.hostRefs),
    output: values.output,
    timeoutMs: Number(values.timeoutMs ?? 900000),
    logLimitBytes: Number(values.logLimitBytes ?? LOG_LIMIT),
  };
}
async function identity(file) { const bytes = await readFile(file); return { sha256: sha256(bytes), bytes: bytes.length }; }
async function inventory(root) {
  const output = [];
  async function walk(directory, relative = '') {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const relativePath = relative ? `${relative}/${name}` : name;
      const entry = await lstat(absolute);
      if (entry.isSymbolicLink()) fail(`symlink is not allowed: ${relativePath}`);
      if (entry.isDirectory()) {
        output.push({ path: relativePath, type: 'directory', mode: entry.mode & 0o777 });
        await walk(absolute, relativePath);
      } else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        output.push({ path: relativePath, type: 'file', mode: entry.mode & 0o777, size: bytes.length, sha256: sha256(bytes) });
      } else fail(`unsupported filesystem entry: ${relativePath}`);
    }
  }
  await walk(root);
  return output;
}
function recomputeSpecIdentity(spec) {
  const copy = structuredClone(spec);
  delete copy.identity;
  return sha256(Buffer.from(stable(copy)));
}
function resolveBinary(name, runner = spawnSync) {
  const result = runner('sh', ['-c', 'command -v "$1"', 'fia-lookup', name], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) fail(`required executable unavailable: ${name}`);
  return result.stdout.trim();
}
function boundedCollector(limit) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  return {
    append(chunk) {
      if (bytes >= limit) { truncated = true; return; }
      const retained = chunk.subarray(0, Math.max(0, limit - bytes));
      chunks.push(retained); bytes += retained.length;
      if (retained.length < chunk.length) truncated = true;
    },
    result() { const data = Buffer.concat(chunks); return { bytes: data.length, sha256: sha256(data), truncated, text: data.toString('utf8') }; },
  };
}
function substituteLauncher(launcher, hostRefs) {
  if (!Array.isArray(launcher) || launcher.some(value => typeof value !== 'string')) fail('invalid launcher');
  return launcher.map(value => {
    const match = /^\{([^{}]+)\}$/.exec(value);
    if (!match) return value;
    const resolved = hostRefs[match[1]];
    if (typeof resolved !== 'string' || !resolved) fail(`missing hostRef: ${match[1]}`);
    return path.resolve(resolved);
  });
}
async function verifyMounts(spec, hostRefs) {
  const verified = [];
  for (const mount of [...spec.mounts.readOnly, ...spec.mounts.writable]) {
    const supplied = hostRefs[mount.hostRef];
    if (typeof supplied !== 'string' || !supplied) fail(`missing hostRef: ${mount.hostRef}`);
    const absolute = path.resolve(supplied);
    const metadata = await stat(absolute).catch(() => null);
    if (!metadata) fail(`mount source unavailable: ${mount.hostRef}`);
    const hostType = metadata.isDirectory() ? 'directory' : metadata.isFile() ? 'file' : 'unsupported';
    if (hostType !== mount.hostType) fail(`mount type drift: ${mount.hostRef}`);
    const actualIdentity = hostType === 'directory' ? sha256(Buffer.from(stable(await inventory(absolute)))) : (await identity(absolute)).sha256;
    if (actualIdentity !== mount.inventoryIdentity) fail(`mount inventory drift: ${mount.hostRef}`);
    verified.push({ hostRef: mount.hostRef, container: mount.container, hostType, inventoryIdentity: actualIdentity });
  }
  return verified;
}
function execute(command, { cwd, timeoutMs, logLimitBytes, spawnImpl = spawn }) {
  return new Promise(resolve => {
    const stdout = boundedCollector(logLimitBytes), stderr = boundedCollector(logLimitBytes);
    let timedOut = false, executionError = null;
    const child = spawnImpl(command[0], command.slice(1), {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC' },
    });
    child.stdout?.on('data', chunk => stdout.append(Buffer.from(chunk)));
    child.stderr?.on('data', chunk => stderr.append(Buffer.from(chunk)));
    child.on('error', error => { executionError = error.message; });
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut, executionError, stdout: stdout.result(), stderr: stderr.result() });
    });
  });
}
export async function runPrivateRootWorker(options, hooks = {}) {
  const specPath = path.resolve(options.spec), output = path.resolve(options.output);
  await ensureAbsent(output);
  if (!options.hostRefs || typeof options.hostRefs !== 'object' || Array.isArray(options.hostRefs)) fail('hostRefs must be an object');
  const timeoutMs = Number(options.timeoutMs ?? 900000), logLimitBytes = Number(options.logLimitBytes ?? LOG_LIMIT);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 86400000) fail('invalid timeoutMs');
  if (!Number.isSafeInteger(logLimitBytes) || logLimitBytes < 1024 || logLimitBytes > 67108864) fail('invalid logLimitBytes');
  const specBytes = await readFile(specPath), spec = JSON.parse(specBytes);
  if (spec.schema !== SPEC_SCHEMA || typeof spec.identity !== 'string') fail('invalid private-root worker specification');
  if (recomputeSpecIdentity(spec) !== spec.identity) fail('private-root specification identity mismatch');
  const resolve = hooks.resolveBinary ?? resolveBinary;
  const bwrapPath = resolve(spec.bwrap.executable);
  const bwrapIdentity = await identity(bwrapPath);
  if (bwrapIdentity.sha256 !== spec.bwrap.sha256 || bwrapIdentity.bytes !== spec.bwrap.bytes) fail('bubblewrap executable drift');
  const mounts = await verifyMounts(spec, options.hostRefs);
  const command = substituteLauncher(spec.launcher, options.hostRefs);
  command[0] = bwrapPath;
  const writableRef = spec.mounts.writable.find(mount => mount.container === '/workspace')?.hostRef;
  if (!writableRef) fail('specification lacks writable /workspace mount');
  const workspace = path.resolve(options.hostRefs[writableRef]);
  const before = await inventory(workspace);
  const run = await (hooks.execute ?? execute)(command, { cwd: workspace, timeoutMs, logLimitBytes, spawnImpl: hooks.spawn });
  const after = await inventory(workspace);
  const record = {
    schema: RUN_SCHEMA,
    spec: { identity: spec.identity, fileSha256: sha256(specBytes), bytes: specBytes.length },
    policy: { timeoutMs, logLimitBytes, processGroupTermination: 'sigkill-on-timeout', mountRevalidation: 'required', executableRevalidation: 'required' },
    bwrap: { executable: spec.bwrap.executable, ...bwrapIdentity },
    mounts,
    workspace: { beforeIdentity: sha256(Buffer.from(stable(before))), afterIdentity: sha256(Buffer.from(stable(after))), before, after },
    result: { status: run.timedOut ? 'timed-out' : run.executionError || run.code !== 0 ? 'failed' : 'succeeded', code: run.code, signal: run.signal, timedOut: run.timedOut, executionError: run.executionError, stdout: run.stdout, stderr: run.stderr },
  };
  record.identity = sha256(Buffer.from(stable(record)));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  if (record.result.status !== 'succeeded') fail(`private-root worker ${record.result.status}`);
  return record;
}
if (import.meta.url === `file://${process.argv[1]}`) runPrivateRootWorker(parseArgs(process.argv)).then(record => process.stdout.write(`${record.identity}\n`)).catch(error => { console.error(error.message); process.exitCode = 1; });
