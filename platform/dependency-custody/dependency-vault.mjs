#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const [command = 'audit', lockPath = 'package-lock.json', vaultDir = 'platform/dependency-custody/vault'] = process.argv.slice(2);
const policy = JSON.parse(await readFile(new URL('./policy.json', import.meta.url), 'utf8'));

function fail(message) {
  console.error(`REJECT ${message}`);
  process.exitCode = 1;
}

function parseSRI(value) {
  if (typeof value !== 'string') return null;
  const [algorithm, encoded] = value.split('-', 2);
  if (!algorithm || !encoded) return null;
  return { algorithm, encoded };
}

function sha512Hex(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function loadLockfile() {
  try {
    return JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${lockPath}: ${error.message}`);
    return null;
  }
}

function collect(lock) {
  if (!lock || typeof lock !== 'object') return [];
  if ((lock.lockfileVersion ?? 0) < policy.lockfileVersionMinimum) {
    fail(`lockfileVersion ${lock.lockfileVersion ?? 'missing'} is below ${policy.lockfileVersionMinimum}`);
  }
  const entries = [];
  for (const [packagePath, descriptor] of Object.entries(lock.packages ?? {})) {
    if (!packagePath || descriptor.link) continue;
    const name = descriptor.name ?? packagePath.replace(/^node_modules\//, '').replace(/.*node_modules\//, '');
    const { version, resolved, integrity } = descriptor;
    if (!version) {
      fail(`${packagePath}: missing exact version`);
      continue;
    }
    if (!resolved) {
      fail(`${packagePath}: missing resolved tarball URL`);
      continue;
    }
    let url;
    try { url = new URL(resolved); } catch { fail(`${packagePath}: non-URL resolution ${resolved}`); continue; }
    if (!policy.allowedResolvedProtocols.includes(url.protocol)) fail(`${packagePath}: protocol ${url.protocol} not allowed`);
    if (!policy.allowedRegistryHosts.includes(url.hostname)) fail(`${packagePath}: registry host ${url.hostname} not allowed`);
    const sri = parseSRI(integrity);
    if (!sri) {
      fail(`${packagePath}: missing or malformed integrity`);
      continue;
    }
    if (sri.algorithm !== policy.requiredIntegrityAlgorithm) fail(`${packagePath}: integrity algorithm ${sri.algorithm} is not ${policy.requiredIntegrityAlgorithm}`);
    entries.push({ packagePath, name, version, resolved: url.href, integrity, sri });
  }
  return entries.sort((a, b) => a.packagePath.localeCompare(b.packagePath));
}

async function audit(entries) {
  if (!entries.length) fail('no external package entries found');
  if (!process.exitCode) console.log(`ACCEPT ${entries.length} dependency records satisfy intake policy`);
}

async function mirror(entries) {
  await mkdir(path.join(vaultDir, 'blobs', 'sha512'), { recursive: true });
  const records = [];
  for (const entry of entries) {
    const response = await fetch(entry.resolved, { redirect: 'error' });
    if (!response.ok) throw new Error(`${entry.resolved}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const actualBase64 = createHash('sha512').update(bytes).digest('base64');
    if (actualBase64 !== entry.sri.encoded) throw new Error(`${entry.packagePath}: SHA-512 mismatch`);
    const sha512 = sha512Hex(bytes);
    const blobRelative = path.posix.join('blobs', 'sha512', `${sha512}.tgz`);
    const blobPath = path.join(vaultDir, blobRelative);
    try {
      await access(blobPath, constants.F_OK);
      const existing = await readFile(blobPath);
      if (sha512Hex(existing) !== sha512) throw new Error(`${blobPath}: existing blob corrupted`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeFile(blobPath, bytes, { flag: 'wx', mode: 0o444 });
    }
    records.push({
      packagePath: entry.packagePath,
      name: entry.name,
      version: entry.version,
      upstream: entry.resolved,
      integrity: entry.integrity,
      blob: blobRelative,
      size: bytes.length,
      sha256: sha256Hex(bytes),
      sha512
    });
  }
  const index = {
    schema: policy.indexSchema,
    generatedFrom: path.basename(lockPath),
    packageCount: records.length,
    records
  };
  index.canonicalSha256 = sha256Hex(Buffer.from(canonical(index)));
  await writeFile(path.join(vaultDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, { mode: 0o444 });
  console.log(`MIRRORED ${records.length} immutable tarballs; index ${index.canonicalSha256}`);
}

async function verifyVault(entries) {
  const index = JSON.parse(await readFile(path.join(vaultDir, 'index.json'), 'utf8'));
  const claimed = index.canonicalSha256;
  const unsigned = { ...index };
  delete unsigned.canonicalSha256;
  const actualIndex = sha256Hex(Buffer.from(canonical(unsigned)));
  if (claimed !== actualIndex) fail('vault index canonical hash mismatch');
  if (index.schema !== policy.indexSchema) fail(`unexpected index schema ${index.schema}`);
  if (index.records?.length !== entries.length) fail('vault index package count differs from lockfile');
  const byPath = new Map(index.records.map((record) => [record.packagePath, record]));
  for (const entry of entries) {
    const record = byPath.get(entry.packagePath);
    if (!record) { fail(`${entry.packagePath}: absent from vault index`); continue; }
    if (record.integrity !== entry.integrity || record.upstream !== entry.resolved || record.version !== entry.version) {
      fail(`${entry.packagePath}: lockfile/index binding mismatch`);
      continue;
    }
    const bytes = await readFile(path.join(vaultDir, record.blob));
    if (sha512Hex(bytes) !== record.sha512) fail(`${entry.packagePath}: vault blob SHA-512 mismatch`);
    if (sha256Hex(bytes) !== record.sha256) fail(`${entry.packagePath}: vault blob SHA-256 mismatch`);
    if (createHash('sha512').update(bytes).digest('base64') !== entry.sri.encoded) fail(`${entry.packagePath}: vault blob violates lockfile SRI`);
  }
  if (!process.exitCode) console.log(`ACCEPT vault contains ${entries.length} lockfile-bound immutable tarballs`);
}

const lock = await loadLockfile();
if (lock) {
  const entries = collect(lock);
  if (!process.exitCode) {
    if (command === 'audit') await audit(entries);
    else if (command === 'mirror') await mirror(entries);
    else if (command === 'verify') await verifyVault(entries);
    else fail(`unknown command ${command}; expected audit, mirror, or verify`);
  }
}
