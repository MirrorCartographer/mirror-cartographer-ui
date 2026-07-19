#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.owned-deployment-restore.v1';
const BUNDLE_SCHEMA = 'fia.owned-deployment-bundle.v1';

function fail(message) { throw new Error(message); }
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function identityFor(value) { const copy = structuredClone(value); delete copy.identity; return sha256(Buffer.from(canonical(copy))); }
function exactKeys(obj, keys, where) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail(`${where} must be an object`);
  const actual = Object.keys(obj).sort(); const expected = [...keys].sort();
  if (canonical(actual) !== canonical(expected)) fail(`${where} fields mismatch: ${actual.join(',')}`);
}
function safeRelative(p) {
  if (typeof p !== 'string' || !p || p.includes('\\') || p.includes('\0') || path.posix.isAbsolute(p)) fail(`unsafe path: ${p}`);
  const normalized = path.posix.normalize(p);
  if (normalized !== p || normalized === '..' || normalized.startsWith('../')) fail(`unsafe path: ${p}`);
  return p;
}
function parseOctal(buf, where) {
  const text = buf.toString('ascii').replace(/\0.*$/, '').trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) fail(`invalid octal ${where}`);
  return Number.parseInt(text, 8);
}
function verifyChecksum(block) {
  const expected = parseOctal(block.subarray(148, 156), 'checksum');
  const tmp = Buffer.from(block); tmp.fill(0x20, 148, 156);
  let sum = 0; for (const byte of tmp) sum += byte;
  if (sum !== expected) fail('USTAR checksum mismatch');
}
function cString(buf) { const i = buf.indexOf(0); return buf.subarray(0, i < 0 ? buf.length : i).toString('utf8'); }

export function parseUstar(archive) {
  if (archive.length % 512 !== 0) fail('archive length is not a multiple of 512');
  const entries = []; const seen = new Set(); let offset = 0; let zeroBlocks = 0;
  while (offset < archive.length) {
    const block = archive.subarray(offset, offset + 512);
    if (block.every(b => b === 0)) { zeroBlocks++; offset += 512; if (zeroBlocks === 2) break; continue; }
    if (zeroBlocks) fail('non-zero data after USTAR zero block');
    verifyChecksum(block);
    const magic = cString(block.subarray(257, 263));
    if (magic !== 'ustar') fail('archive is not USTAR');
    const prefix = cString(block.subarray(345, 500));
    const name = cString(block.subarray(0, 100));
    const full = safeRelative(prefix ? `${prefix}/${name}` : name);
    if (seen.has(full)) fail(`duplicate archive path: ${full}`); seen.add(full);
    const type = String.fromCharCode(block[156] || 48);
    if (type !== '0' && type !== '\0') fail(`unsupported archive entry type ${type} for ${full}`);
    const size = parseOctal(block.subarray(124, 136), `size for ${full}`);
    const mode = parseOctal(block.subarray(100, 108), `mode for ${full}`) & 0o777;
    const dataStart = offset + 512; const dataEnd = dataStart + size;
    if (dataEnd > archive.length) fail(`truncated archive entry: ${full}`);
    entries.push({ path: full, size, mode, data: Buffer.from(archive.subarray(dataStart, dataEnd)), sha256: sha256(archive.subarray(dataStart, dataEnd)) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  if (zeroBlocks < 2) fail('archive missing terminal zero blocks');
  if (archive.subarray(offset).some(b => b !== 0)) fail('non-zero trailing archive bytes');
  return entries;
}

async function exclusiveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(`${canonical(value)}\n`); await handle.sync(); } finally { await handle.close(); }
}

export async function verifyRestore({ evidencePath, archivePath, restoreDir, outputPath }) {
  const evidenceBytes = await readFile(evidencePath); const evidence = JSON.parse(evidenceBytes);
  if (evidence.schema !== BUNDLE_SCHEMA) fail(`expected ${BUNDLE_SCHEMA}`);
  if (evidence.identity !== identityFor(evidence)) fail('stale deployment bundle identity');
  exactKeys(evidence, ['schema','identity','archive','manifest','releaseIdentity'], 'deployment evidence');
  exactKeys(evidence.archive, ['sha256','size'], 'archive evidence');
  exactKeys(evidence.manifest, ['entries'], 'manifest evidence');
  if (!Array.isArray(evidence.manifest.entries) || evidence.manifest.entries.length === 0) fail('manifest entries required');

  const archive = await readFile(archivePath);
  if (archive.length !== evidence.archive.size || sha256(archive) !== evidence.archive.sha256) fail('archive bytes do not match evidence');
  const entries = parseUstar(archive);
  const byPath = new Map(entries.map(e => [e.path, e]));
  const declared = new Set();
  for (const item of evidence.manifest.entries) {
    exactKeys(item, ['path','mode','size','sha256'], 'manifest entry');
    safeRelative(item.path); if (declared.has(item.path)) fail(`duplicate manifest path: ${item.path}`); declared.add(item.path);
    const actual = byPath.get(item.path); if (!actual) fail(`archive missing manifest entry: ${item.path}`);
    if (actual.size !== item.size || actual.sha256 !== item.sha256 || actual.mode !== item.mode) fail(`archive entry mismatch: ${item.path}`);
  }
  if (byPath.size !== declared.size) fail('archive contains undeclared entries');

  try { await stat(restoreDir); fail('restore directory already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = `${restoreDir}.staging-${process.pid}`;
  await rm(staging, { recursive: true, force: true }); await mkdir(staging, { recursive: false, mode: 0o700 });
  try {
    for (const entry of entries) {
      const dest = path.join(staging, ...entry.path.split('/'));
      const rel = path.relative(staging, dest); if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`extraction escape: ${entry.path}`);
      await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, entry.data, { mode: entry.mode, flag: 'wx' });
    }
    const restored = [];
    for (const item of evidence.manifest.entries) {
      const file = path.join(staging, ...item.path.split('/')); const bytes = await readFile(file); const meta = await stat(file);
      const record = { path: item.path, mode: meta.mode & 0o777, size: bytes.length, sha256: sha256(bytes) };
      if (record.mode !== item.mode || record.size !== item.size || record.sha256 !== item.sha256) fail(`restored file mismatch: ${item.path}`);
      restored.push(record);
    }
    restored.sort((a,b) => a.path.localeCompare(b.path));
    await rename(staging, restoreDir);
    const result = { schema: SCHEMA, releaseIdentity: evidence.releaseIdentity, sourceBundleIdentity: evidence.identity, archiveSha256: evidence.archive.sha256, restored, policy: { parser: 'owned-ustar-v1', duplicatePaths: 'reject', unsafePaths: 'reject', undeclaredEntries: 'reject', existingRestore: 'reject', postExtractHashing: 'required' } };
    result.identity = identityFor(result);
    await exclusiveJson(outputPath, result);
    return result;
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
}

function args(argv) { const out = {}; for (let i=2;i<argv.length;i+=2) { const k=argv[i]; if (!k?.startsWith('--') || argv[i+1] === undefined) fail('arguments must be --key value pairs'); out[k.slice(2)] = argv[i+1]; } return out; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args(process.argv);
  for (const k of ['evidence','archive','restoreDir','output']) if (!a[k]) fail(`missing --${k}`);
  verifyRestore({ evidencePath: a.evidence, archivePath: a.archive, restoreDir: a.restoreDir, outputPath: a.output })
    .then(r => process.stdout.write(`${canonical({ schema: r.schema, identity: r.identity, restoredFiles: r.restored.length })}\n`))
    .catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
}
