#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const SCHEMA = 'foundation.build.dependency-installation.v1';
const SBOM_SCHEMA = 'foundation.build.dependency-sbom.v1';
const POLICY = Object.freeze({
  archiveFormat: 'ustar',
  rejectLinks: true,
  rejectDevices: true,
  rejectTraversal: true,
  rejectDuplicatePaths: true,
  rejectCaseFoldCollisions: true,
  normalizeModes: true,
  normalizeTimestamps: true,
  lifecycleScripts: false,
  networkFallback: false,
  providerNeutral: true,
});

function sha256(data) { return `sha256:${createHash('sha256').update(data).digest('hex')}`; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
function safeRel(value, context='path') {
  const normalized = value.normalize('NFC').replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) throw new Error(`${context}: unsafe path`);
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`${context}: unsafe path`);
  return normalized;
}
function parseOctal(buffer, context) {
  const text = buffer.toString('ascii').replace(/\0.*$/s, '').trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error(`${context}: invalid tar octal field`);
  return Number.parseInt(text, 8);
}
function tarChecksum(block) {
  let total = 0;
  for (let i = 0; i < 512; i += 1) total += (i >= 148 && i < 156) ? 32 : block[i];
  return total;
}
function entryName(block) {
  const name = block.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
  const prefix = block.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '');
  return prefix ? `${prefix}/${name}` : name;
}
function parseTar(gzipBytes, packageLabel) {
  let tar;
  try { tar = gunzipSync(gzipBytes); } catch { throw new Error(`${packageLabel}: invalid gzip package`); }
  const entries = [];
  const exact = new Set();
  const folded = new Set();
  let offset = 0;
  let sawEnd = false;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) { sawEnd = true; break; }
    const expected = parseOctal(header.subarray(148, 156), `${packageLabel}: checksum`);
    if (expected !== tarChecksum(header)) throw new Error(`${packageLabel}: tar checksum mismatch`);
    const magic = header.subarray(257, 263).toString('ascii').replace(/\0.*$/s, '');
    if (magic && magic !== 'ustar') throw new Error(`${packageLabel}: unsupported tar format`);
    const rawName = entryName(header);
    const archivePath = safeRel(rawName, `${packageLabel}: archive path`);
    if (!archivePath.startsWith('package/')) throw new Error(`${packageLabel}: entry outside package root`);
    const rel = archivePath.slice('package/'.length);
    if (!rel) throw new Error(`${packageLabel}: empty package entry`);
    safeRel(rel, `${packageLabel}: package path`);
    const fold = rel.toLocaleLowerCase('en-US');
    if (exact.has(rel)) throw new Error(`${packageLabel}: duplicate archive path ${rel}`);
    if (folded.has(fold)) throw new Error(`${packageLabel}: case-fold collision ${rel}`);
    exact.add(rel); folded.add(fold);
    const size = parseOctal(header.subarray(124, 136), `${packageLabel}: size`);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error(`${packageLabel}: truncated tar entry ${rel}`);
    if (type === '1' || type === '2') throw new Error(`${packageLabel}: links are not authorized`);
    if (['3','4','6','7','g','x','L','K'].includes(type)) throw new Error(`${packageLabel}: unsupported tar entry type ${type}`);
    if (type !== '0' && type !== '\0' && type !== '5') throw new Error(`${packageLabel}: unsupported tar entry type ${type}`);
    entries.push({ rel, type: type === '5' ? 'directory' : 'file', bytes: tar.subarray(dataStart, dataEnd), archiveMode: parseOctal(header.subarray(100,108), `${packageLabel}: mode`) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  if (!sawEnd) throw new Error(`${packageLabel}: tar end marker missing`);
  return entries;
}
function declaredBins(pkg) {
  const out = new Set();
  if (typeof pkg.bin === 'string') out.add(safeRel(pkg.bin, 'package bin'));
  else if (pkg.bin && typeof pkg.bin === 'object' && !Array.isArray(pkg.bin)) {
    for (const value of Object.values(pkg.bin)) if (typeof value === 'string') out.add(safeRel(value, 'package bin'));
  }
  return out;
}
async function fsyncDir(dir) { const handle = await fs.open(dir, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
async function loadJson(file, label) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { throw new Error(`${label} is not valid JSON`); } }

export async function installDependencies({ lockfile, materialized, output }) {
  const lockfilePath = path.resolve(lockfile);
  const materializedRoot = path.resolve(materialized);
  const outputRoot = path.resolve(output);
  if (await exists(outputRoot)) throw new Error(`output exists: ${outputRoot}`);
  const lockBytes = await fs.readFile(lockfilePath);
  const materialization = await loadJson(path.join(materializedRoot, 'materialization.json'), 'materialization.json');
  if (materialization.schema !== 'foundation.build.dependency-materialization.v1') throw new Error('unsupported materialization schema');
  if (materialization.lockfileSha256 !== sha256(lockBytes)) throw new Error('materialization lockfile identity mismatch');
  if (!Array.isArray(materialization.packages) || !materialization.packages.length) throw new Error('materialization contains no packages');
  const stage = `${outputRoot}.tmp-${process.pid}`;
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(path.join(stage, 'node_modules'), { recursive: true });
  const packages = [];
  try {
    for (const record of [...materialization.packages].sort((a,b)=>a.lockPath.localeCompare(b.lockPath,'en'))) {
      const lockPath = safeRel(record.lockPath, 'lockfile package path');
      if (!lockPath.startsWith('node_modules/') && !lockPath.includes('/node_modules/')) throw new Error(`${lockPath}: invalid installation path`);
      const objectPath = path.join(materializedRoot, safeRel(record.objectPath, `${lockPath}: object path`));
      const objectBytes = await fs.readFile(objectPath);
      if (sha256(objectBytes) !== record.sha256 || objectBytes.length !== record.size) throw new Error(`${lockPath}: materialized object identity mismatch`);
      const entries = parseTar(objectBytes, `${record.name}@${record.version}`);
      const packageJsonEntry = entries.find(entry => entry.type === 'file' && entry.rel === 'package.json');
      if (!packageJsonEntry) throw new Error(`${lockPath}: package/package.json required`);
      let pkg;
      try { pkg = JSON.parse(packageJsonEntry.bytes.toString('utf8')); } catch { throw new Error(`${lockPath}: package.json is not valid JSON`); }
      if (pkg.name !== record.name || pkg.version !== record.version) throw new Error(`${lockPath}: package metadata disagrees with lockfile`);
      const bins = declaredBins(pkg);
      const installRoot = path.join(stage, lockPath);
      await fs.mkdir(installRoot, { recursive: true, mode: 0o755 });
      const files = [];
      for (const entry of entries.sort((a,b)=>a.rel.localeCompare(b.rel,'en'))) {
        const destination = path.join(installRoot, ...entry.rel.split('/'));
        const resolved = path.resolve(destination);
        if (resolved !== installRoot && !resolved.startsWith(`${installRoot}${path.sep}`)) throw new Error(`${lockPath}: extraction escaped package root`);
        if (entry.type === 'directory') { await fs.mkdir(destination, { recursive: true, mode: 0o755 }); continue; }
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o755 });
        const executable = (entry.archiveMode & 0o111) !== 0;
        if (executable && !bins.has(entry.rel)) throw new Error(`${lockPath}: undeclared executable ${entry.rel}`);
        const mode = executable ? 0o755 : 0o644;
        await fs.writeFile(destination, entry.bytes, { flag: 'wx', mode });
        await fs.chmod(destination, mode);
        await fs.utimes(destination, 0, 0);
        files.push({ path: entry.rel, sha256: sha256(entry.bytes), size: entry.bytes.length, mode });
      }
      packages.push({ lockPath, name: record.name, version: record.version, integrity: record.integrity, sourceSha256: record.sha256, dev: record.dev === true, optional: record.optional === true, files });
    }
    const authority = { schema: SCHEMA, lockfileSha256: sha256(lockBytes), materializationIdentity: materialization.identity, packages, policy: POLICY };
    const identity = sha256(Buffer.from(canonical(authority)));
    const tree = { ...authority, identity };
    const sbomAuthority = { schema: SBOM_SCHEMA, installationIdentity: identity, components: packages.map(pkg => ({ type:'library', name:pkg.name, version:pkg.version, path:pkg.lockPath, hashes:[pkg.sourceSha256], dev:pkg.dev, optional:pkg.optional })) };
    const sbom = { ...sbomAuthority, identity: sha256(Buffer.from(canonical(sbomAuthority))) };
    await fs.writeFile(path.join(stage, 'dependency-tree.json'), `${canonical(tree)}\n`, { flag:'wx', mode:0o444 });
    await fs.writeFile(path.join(stage, 'sbom.json'), `${canonical(sbom)}\n`, { flag:'wx', mode:0o444 });
    await fsyncDir(stage);
    await fs.mkdir(path.dirname(outputRoot), { recursive:true });
    await fs.rename(stage, outputRoot);
    await fsyncDir(path.dirname(outputRoot));
    return tree;
  } catch (error) { await fs.rm(stage, { recursive:true, force:true }); throw error; }
}

async function cli() {
  const args = process.argv.slice(2); const get = name => { const i=args.indexOf(name); return i>=0 ? args[i+1] : undefined; };
  const lockfile=get('--lockfile'), materialized=get('--materialized'), output=get('--output');
  if (!lockfile || !materialized || !output) throw new Error('usage: fia-dependency-install --lockfile package-lock.json --materialized <dir> --output <dir>');
  const result = await installDependencies({ lockfile, materialized, output });
  process.stdout.write(`${result.identity}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(error => { console.error(error.message); process.exitCode=1; });
