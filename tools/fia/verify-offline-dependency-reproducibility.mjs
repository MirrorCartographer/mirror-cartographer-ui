#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const SCHEMA = 'fia.offline-dependency-reproducibility.v1';
const CACHE_SCHEMA = 'fia.owned-npm-cache.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function stable(value) { return JSON.stringify(canonical(value)); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(message) { throw new Error(message); }
function parseJson(bytes, label) { try { return JSON.parse(bytes.toString('utf8')); } catch { fail(`${label} is not valid JSON`); } }
function parseArgs(argv) {
  const out = { attempts: '2', npm: process.env.FIA_NPM ?? 'npm' };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[key.slice(2)] = value;
  }
  for (const key of ['source', 'lockfile', 'cacheDir', 'cacheManifest', 'output']) if (!out[key]) fail(`missing --${key}`);
  const attempts = Number(out.attempts);
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 8) fail('--attempts must be an integer from 2 through 8');
  return { ...out, attempts };
}
async function ensureAbsent(target) {
  try { await stat(target); fail(`destination already exists: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = { code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
      if (code !== 0) reject(Object.assign(new Error(`${command} failed with exit code ${code}`), { result })); else resolve(result);
    });
  });
}
async function inventory(root) {
  const entries = [];
  async function walk(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name); const relative = path.posix.join(prefix, name); const info = await lstat(absolute);
      if (info.isSymbolicLink()) fail(`symlink is not allowed in installed dependencies: ${relative}`);
      if (info.isDirectory()) { entries.push({ path: `${relative}/`, type: 'directory', mode: info.mode & 0o777 }); await walk(absolute, relative); }
      else if (info.isFile()) { const bytes = await readFile(absolute); entries.push({ path: relative, type: 'file', mode: info.mode & 0o777, bytes: bytes.length, sha256: sha256(bytes) }); }
      else fail(`unsupported filesystem entry in installed dependencies: ${relative}`);
    }
  }
  await walk(root); return entries;
}
function validateCacheManifest(record, bytes, lockBytes) {
  if (record.schema !== CACHE_SCHEMA) fail(`cache manifest schema must be ${CACHE_SCHEMA}`);
  if (!Array.isArray(record.objects) || !Array.isArray(record.packages)) fail('cache manifest is incomplete');
  const identity = record.identity;
  if (typeof identity !== 'string') fail('cache manifest identity is missing');
  const withoutIdentity = { ...record }; delete withoutIdentity.identity;
  if (sha256(Buffer.from(stable(withoutIdentity))) !== identity) fail('cache manifest identity mismatch');
  if (record.lockfile?.sha256 !== sha256(lockBytes) || record.lockfile?.bytes !== lockBytes.length) fail('cache manifest does not bind the supplied lockfile');
  return { identity, bytesSha256: sha256(bytes) };
}
async function verifyObjects(cacheDir, record) {
  const allowed = new Set();
  for (const object of record.objects) {
    if (!/^[a-f0-9]{64}$/.test(object.sha256) || !Number.isInteger(object.bytes) || typeof object.path !== 'string') fail('invalid cache object record');
    const normalized = path.posix.normalize(object.path.replaceAll('\\', '/'));
    if (path.isAbsolute(object.path) || normalized.startsWith('../') || normalized === '..') fail(`cache object path escapes cache: ${object.path}`);
    if (allowed.has(normalized)) fail(`duplicate cache object path: ${normalized}`);
    allowed.add(normalized);
    const absolute = path.resolve(cacheDir, normalized); const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) fail(`cache object is not a regular file: ${normalized}`);
    const bytes = await readFile(absolute);
    if (bytes.length !== object.bytes || sha256(bytes) !== object.sha256) fail(`cache object identity mismatch: ${normalized}`);
  }
  return [...allowed].sort();
}
async function copyWorkspaceSource(source, destination) {
  await cp(source, destination, { recursive: true, dereference: false, filter: (entry) => !entry.split(path.sep).includes('node_modules') });
}

export async function verifyOfflineDependencyReproducibility(options) {
  const source = path.resolve(options.source); const lockfile = path.resolve(options.lockfile); const cacheDir = path.resolve(options.cacheDir);
  const cacheManifest = path.resolve(options.cacheManifest); const output = path.resolve(options.output);
  const attempts = Number(options.attempts ?? 2); const npm = options.npm ?? process.env.FIA_NPM ?? 'npm';
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 8) fail('attempts must be an integer from 2 through 8');
  await ensureAbsent(output);
  const [lockBytes, manifestBytes] = await Promise.all([readFile(lockfile), readFile(cacheManifest)]);
  const manifest = parseJson(manifestBytes, 'cache manifest'); const cacheIdentity = validateCacheManifest(manifest, manifestBytes, lockBytes);
  const objectPaths = await verifyObjects(cacheDir, manifest); const root = await mkdtemp(path.join(tmpdir(), 'fia-offline-install-')); const results = [];
  try {
    for (let index = 0; index < attempts; index += 1) {
      const workspace = path.join(root, `workspace-${index + 1}`); const npmCache = path.join(root, `npm-cache-${index + 1}`);
      await copyWorkspaceSource(source, workspace); await mkdir(npmCache, { recursive: true });
      await writeFile(path.join(workspace, path.basename(lockfile)), lockBytes, { flag: 'w' });
      for (const objectPath of objectPaths) {
        await run(npm, ['cache', 'add', path.join(cacheDir, objectPath), '--cache', npmCache, '--ignore-scripts'], {
          cwd: workspace,
          env: { ...process.env, npm_config_registry: 'http://127.0.0.1:9', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
        });
      }
      const install = await run(npm, ['ci', '--offline', '--ignore-scripts', '--cache', npmCache, '--no-audit', '--no-fund'], {
        cwd: workspace,
        env: { ...process.env, npm_config_registry: 'http://127.0.0.1:9', npm_config_offline: 'true', npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
      });
      const installed = await inventory(path.join(workspace, 'node_modules')); const inventoryIdentity = sha256(Buffer.from(stable(installed)));
      results.push({ attempt: index + 1, inventory: installed, inventoryIdentity,
        stdout: { bytes: install.stdout.length, sha256: sha256(install.stdout) }, stderr: { bytes: install.stderr.length, sha256: sha256(install.stderr) } });
    }
    const expected = results[0].inventoryIdentity;
    for (const result of results.slice(1)) if (result.inventoryIdentity !== expected) fail(`offline dependency inventory diverged at attempt ${result.attempt}`);
    const record = {
      schema: SCHEMA,
      policy: { attempts, networkDuringInstall: false, lifecycleScripts: false, registry: 'closed-loopback', symlinks: 'reject', comparison: ['path', 'type', 'mode', 'bytes', 'sha256'] },
      lockfile: { sha256: sha256(lockBytes), bytes: lockBytes.length },
      cacheManifest: { identity: cacheIdentity.identity, bytesSha256: cacheIdentity.bytesSha256, bytes: manifestBytes.length },
      cacheObjects: objectPaths.length,
      dependencyInventoryIdentity: expected,
      dependencyInventory: results[0].inventory,
      attempts: results.map(({ attempt, inventoryIdentity, stdout, stderr }) => ({ attempt, inventoryIdentity, stdout, stderr })),
    };
    record.identity = sha256(Buffer.from(stable(record)));
    await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' }); return record;
  } finally { await rm(root, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyOfflineDependencyReproducibility(parseArgs(process.argv))
    .then((record) => process.stdout.write(`${record.identity}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
