#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SCHEMA = 'foundation.build.dependency-materialization.v1';
const POLICY = Object.freeze({
  lockfileVersion: 3,
  registryHost: 'registry.npmjs.org',
  requireHttps: true,
  requireSha512Integrity: true,
  networkFallback: false,
  lifecycleScripts: false,
  providerNeutral: true,
});

function sha256(data) { return `sha256:${createHash('sha256').update(data).digest('hex')}`; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
function packageNameFromPath(lockPath, record) {
  if (typeof record.name === 'string' && record.name) return record.name;
  const marker = 'node_modules/';
  const index = lockPath.lastIndexOf(marker);
  if (index < 0) throw new Error(`cannot derive package name from ${lockPath}`);
  return lockPath.slice(index + marker.length);
}
function cacheFilename(name, version) {
  return `${encodeURIComponent(name)}-${version}.tgz`;
}
function validateResolved(value, lockPath) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${lockPath}: invalid resolved URL`); }
  if (parsed.protocol !== 'https:') throw new Error(`${lockPath}: dependency source must use HTTPS`);
  if (parsed.hostname !== POLICY.registryHost) throw new Error(`${lockPath}: unauthorized registry host ${parsed.hostname}`);
  if (!parsed.pathname.endsWith('.tgz')) throw new Error(`${lockPath}: resolved source is not a package tarball`);
}
function parseIntegrity(integrity, lockPath) {
  if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) throw new Error(`${lockPath}: missing SHA-512 integrity`);
  const encoded = integrity.slice(7);
  let expected;
  try { expected = Buffer.from(encoded, 'base64'); } catch { throw new Error(`${lockPath}: invalid integrity encoding`); }
  if (expected.length !== 64 || expected.toString('base64') !== encoded) throw new Error(`${lockPath}: invalid SHA-512 integrity`);
  return expected;
}
function normalizePackages(lock) {
  if (lock.lockfileVersion !== POLICY.lockfileVersion) throw new Error(`package-lock.json must use lockfileVersion ${POLICY.lockfileVersion}`);
  if (!lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) throw new Error('package-lock.json packages map is required');
  const records = [];
  for (const lockPath of Object.keys(lock.packages).sort((a,b)=>a.localeCompare(b,'en'))) {
    if (!lockPath) continue;
    if (!lockPath.includes('node_modules/')) continue;
    const record = lock.packages[lockPath];
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${lockPath}: invalid package record`);
    const name = packageNameFromPath(lockPath, record);
    const version = record.version;
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`${lockPath}: exact semantic version required`);
    if (record.link) throw new Error(`${lockPath}: workspace/link dependencies are not authorized`);
    if (record.hasInstallScript) throw new Error(`${lockPath}: lifecycle scripts are not authorized`);
    if (typeof record.resolved !== 'string') throw new Error(`${lockPath}: resolved source required`);
    validateResolved(record.resolved, lockPath);
    const expectedSha512 = parseIntegrity(record.integrity, lockPath);
    records.push({
      lockPath,
      name,
      version,
      resolved: record.resolved,
      integrity: record.integrity,
      expectedSha512,
      dev: record.dev === true,
      optional: record.optional === true,
    });
  }
  if (!records.length) throw new Error('package-lock.json contains no materializable packages');
  return records;
}
async function fsyncDir(dir) {
  const handle = await fs.open(dir, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function verifyTarball(file, expectedSha512) {
  const bytes = await fs.readFile(file);
  const actual = createHash('sha512').update(bytes).digest();
  if (!actual.equals(expectedSha512)) throw new Error(`cache integrity mismatch: ${path.basename(file)}`);
  return { bytes, sha256: sha256(bytes), size: bytes.length };
}
export async function materializeDependencies({ lockfile, sourceCache, output, nodeVersion, npmVersion }) {
  const lockfilePath = path.resolve(lockfile);
  const cacheRoot = path.resolve(sourceCache);
  const outputRoot = path.resolve(output);
  if (await exists(outputRoot)) throw new Error(`output exists: ${outputRoot}`);
  if (!nodeVersion || !npmVersion) throw new Error('declared Node and npm versions are required');
  const lockBytes = await fs.readFile(lockfilePath);
  let lock;
  try { lock = JSON.parse(lockBytes); } catch { throw new Error('package-lock.json is not valid JSON'); }
  const records = normalizePackages(lock);
  const stage = `${outputRoot}.tmp-${process.pid}`;
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(path.join(stage, 'objects', 'sha512'), { recursive: true });
  const packages = [];
  try {
    for (const record of records) {
      const source = path.join(cacheRoot, cacheFilename(record.name, record.version));
      if (!await exists(source)) throw new Error(`offline cache miss: ${record.name}@${record.version}`);
      const verified = await verifyTarball(source, record.expectedSha512);
      const objectName = record.integrity.slice(7).replaceAll('/', '_');
      const destination = path.join(stage, 'objects', 'sha512', `${objectName}.tgz`);
      await fs.writeFile(destination, verified.bytes, { flag: 'wx', mode: 0o444 });
      packages.push({
        lockPath: record.lockPath,
        name: record.name,
        version: record.version,
        resolved: record.resolved,
        integrity: record.integrity,
        sha256: verified.sha256,
        size: verified.size,
        objectPath: `objects/sha512/${objectName}.tgz`,
        dev: record.dev,
        optional: record.optional,
      });
    }
    const authority = {
      schema: SCHEMA,
      lockfileSha256: sha256(lockBytes),
      nodeVersion,
      npmVersion,
      packages,
      policy: POLICY,
    };
    const identity = sha256(Buffer.from(canonical(authority)));
    const evidence = { ...authority, identity };
    await fs.writeFile(path.join(stage, 'materialization.json'), `${canonical(evidence)}\n`, { flag: 'wx', mode: 0o444 });
    await fsyncDir(path.join(stage, 'objects', 'sha512'));
    await fsyncDir(stage);
    await fs.mkdir(path.dirname(outputRoot), { recursive: true });
    await fs.rename(stage, outputRoot);
    await fsyncDir(path.dirname(outputRoot));
    return evidence;
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true });
    throw error;
  }
}

async function cli() {
  const args = process.argv.slice(2);
  const get = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const lockfile = get('--lockfile');
  const sourceCache = get('--sourceCache');
  const output = get('--output');
  const nodeVersion = get('--nodeVersion');
  const npmVersion = get('--npmVersion');
  if (!lockfile || !sourceCache || !output || !nodeVersion || !npmVersion) {
    throw new Error('usage: fia-dependency-materialize --lockfile package-lock.json --sourceCache <dir> --output <dir> --nodeVersion <version> --npmVersion <version>');
  }
  const result = await materializeDependencies({ lockfile, sourceCache, output, nodeVersion, npmVersion });
  process.stdout.write(`${result.identity}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
