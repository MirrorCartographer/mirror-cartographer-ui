#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.owned-npm-cache.v1';
const PLAN_SCHEMA = 'fia.owned-npm-cache-import-plan.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function stable(value) { return JSON.stringify(canonical(value)); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(message) { throw new Error(message); }
function parseJson(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { fail(`${label} is not valid JSON`); }
}
function parseIntegrity(value) {
  if (typeof value !== 'string') fail('dependency integrity is missing');
  const candidates = value.trim().split(/\s+/).map((item) => item.split('-', 2));
  const supported = candidates.find(([algorithm, digest]) => ['sha256', 'sha384', 'sha512'].includes(algorithm) && digest);
  if (!supported) fail(`unsupported integrity: ${value}`);
  return { algorithm: supported[0], digest: supported[1] };
}
function verifyIntegrity(bytes, integrity) {
  const { algorithm, digest } = parseIntegrity(integrity);
  const actual = createHash(algorithm).update(bytes).digest('base64');
  if (actual !== digest) fail(`tarball integrity mismatch for ${integrity}`);
}
function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[key.slice(2)] = value;
  }
  for (const key of ['lockfile', 'plan', 'outputDir', 'manifest']) if (!out[key]) fail(`missing --${key}`);
  return out;
}
function dependencies(lock) {
  if (![2, 3].includes(lock.lockfileVersion) || !lock.packages || typeof lock.packages !== 'object') {
    fail('lockfile must be npm v2/v3 with packages graph');
  }
  return Object.entries(lock.packages)
    .filter(([packagePath]) => packagePath !== '')
    .map(([packagePath, record]) => {
      if (!record || typeof record !== 'object') fail(`invalid lockfile record: ${packagePath}`);
      if (!record.version || !record.resolved || !record.integrity) fail(`incomplete lockfile record: ${packagePath}`);
      parseIntegrity(record.integrity);
      return {
        path: packagePath,
        name: record.name ?? packagePath.split('node_modules/').at(-1),
        version: record.version,
        resolved: record.resolved,
        integrity: record.integrity,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function importOwnedCache(options) {
  const lockfilePath = path.resolve(options.lockfile);
  const planPath = path.resolve(options.plan);
  const outputDir = path.resolve(options.outputDir);
  const manifestPath = path.resolve(options.manifest);

  for (const target of [outputDir, manifestPath]) {
    try {
      await stat(target);
      fail(`destination already exists: ${target}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  const lockBytes = await readFile(lockfilePath);
  const planBytes = await readFile(planPath);
  const lock = parseJson(lockBytes, 'lockfile');
  const plan = parseJson(planBytes, 'import plan');
  if (plan.schema !== PLAN_SCHEMA || !Array.isArray(plan.packages)) fail(`plan schema must be ${PLAN_SCHEMA}`);

  const byIntegrity = new Map();
  for (const dependency of dependencies(lock)) {
    const prior = byIntegrity.get(dependency.integrity);
    if (prior && prior.resolved !== dependency.resolved) {
      fail(`same integrity has conflicting resolved URLs: ${dependency.integrity}`);
    }
    if (!prior) {
      byIntegrity.set(dependency.integrity, {
        integrity: dependency.integrity,
        resolved: dependency.resolved,
        paths: [],
      });
    }
    byIntegrity.get(dependency.integrity).paths.push(dependency.path);
  }

  const planMap = new Map();
  for (const item of plan.packages) {
    if (!item || typeof item !== 'object' || typeof item.integrity !== 'string' || typeof item.file !== 'string') {
      fail('invalid import-plan package entry');
    }
    if (path.isAbsolute(item.file)) fail(`plan file must be relative: ${item.file}`);
    const normalized = path.posix.normalize(item.file.replaceAll('\\', '/'));
    if (normalized.startsWith('../') || normalized === '..') fail(`plan file escapes plan directory: ${item.file}`);
    if (planMap.has(item.integrity)) fail(`duplicate plan integrity: ${item.integrity}`);
    planMap.set(item.integrity, normalized);
  }
  for (const integrity of byIntegrity.keys()) {
    if (!planMap.has(integrity)) fail(`missing tarball mapping for ${integrity}`);
  }
  for (const integrity of planMap.keys()) {
    if (!byIntegrity.has(integrity)) fail(`surplus tarball mapping for ${integrity}`);
  }

  const staging = `${outputDir}.staging-${process.pid}`;
  await mkdir(path.join(staging, 'objects', 'sha256'), { recursive: true });
  const objects = new Map();

  try {
    for (const [integrity, authority] of [...byIntegrity.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const source = path.resolve(path.dirname(planPath), planMap.get(integrity));
      const sourceStat = await stat(source);
      if (!sourceStat.isFile()) fail(`tarball source is not a regular file: ${source}`);
      const bytes = await readFile(source);
      verifyIntegrity(bytes, integrity);
      const digest = sha256(bytes);
      const objectPath = `objects/sha256/${digest}.tgz`;
      if (!objects.has(digest)) {
        await writeFile(path.join(staging, objectPath), bytes, { flag: 'wx' });
        objects.set(digest, { sha256: digest, bytes: bytes.length, path: objectPath });
      }
      authority.paths.sort();
      authority.sha256 = digest;
      authority.bytes = bytes.length;
      authority.object = objectPath;
    }

    const record = {
      schema: SCHEMA,
      policy: {
        networkDuringImport: false,
        lifecycleScripts: false,
        surplusMaterial: 'reject',
        addressing: 'sha256',
      },
      lockfile: {
        sha256: sha256(lockBytes),
        bytes: lockBytes.length,
        lockfileVersion: lock.lockfileVersion,
      },
      importPlan: { sha256: sha256(planBytes), bytes: planBytes.length },
      packages: [...byIntegrity.values()].sort((a, b) => a.integrity.localeCompare(b.integrity)),
      objects: [...objects.values()].sort((a, b) => a.sha256.localeCompare(b.sha256)),
    };
    record.identity = sha256(Buffer.from(stable(record)));
    const manifestBytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`);
    await writeFile(path.join(staging, 'cache-manifest.json'), manifestBytes, { flag: 'wx' });
    await rename(staging, outputDir);
    await writeFile(manifestPath, manifestBytes, { flag: 'wx' });
    return record;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importOwnedCache(args(process.argv))
    .then((record) => process.stdout.write(`${record.identity}\n`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
