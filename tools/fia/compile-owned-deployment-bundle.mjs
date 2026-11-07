#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUEST_SCHEMA = 'fia.owned-deployment-bundle-request.v1';
const OUTPUT_SCHEMA = 'fia.owned-deployment-bundle.v1';
const POLICY = Object.freeze({ digest: 'sha256', paths: 'relative-posix-no-symlinks', archive: 'ustar-canonical-v1', timestamps: 0, uid: 0, gid: 0, fileMode: 0o644, directoryMode: 0o755, overwrite: false });

function fail(message) { throw new Error(message); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function identity(value) { return sha256(Buffer.from(canonical(value))); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  if (canonical(Object.keys(value).sort()) !== canonical([...keys].sort())) fail(`${label} fields must be exactly: ${[...keys].sort().join(', ')}`);
}
function safeRelative(input, label) {
  if (typeof input !== 'string' || input.length === 0) fail(`${label} must be a non-empty string`);
  if (input.includes('\\') || path.posix.isAbsolute(input) || input.includes('\0')) fail(`${label} is unsafe: ${input}`);
  const normalized = path.posix.normalize(input);
  if (normalized !== input || normalized === '.' || normalized === '..' || normalized.startsWith('../')) fail(`${label} is unsafe: ${input}`);
  return input;
}
function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || argv[index + 1] === undefined) fail('arguments must be --name value pairs');
    result[key.slice(2)] = argv[index + 1];
  }
  for (const key of ['request', 'root', 'bundleDir', 'archive', 'output']) if (!result[key]) fail(`missing --${key}`);
  return result;
}
async function readJson(file, label) {
  let bytes;
  try { bytes = await readFile(file); } catch { fail(`cannot read ${label}: ${file}`); }
  try { return { bytes, value: JSON.parse(bytes) }; } catch { fail(`${label} is not valid JSON`); }
}
function verifyLogicalIdentity(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`${label} must be an object`);
  if (typeof record.identity !== 'string' || !/^[0-9a-f]{64}$/.test(record.identity)) fail(`${label}.identity must be sha256 hex`);
  const material = { ...record }; delete material.identity;
  const computed = identity(material);
  if (computed !== record.identity) fail(`${label} identity mismatch`);
  return computed;
}
async function assertRegularNoSymlink(root, relative) {
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    const info = await lstat(current).catch(() => null);
    if (!info) fail(`runtime artifact missing: ${relative}`);
    if (info.isSymbolicLink()) fail(`symbolic link rejected: ${relative}`);
  }
  if (!(await stat(path.join(root, relative))).isFile()) fail(`runtime artifact is not a regular file: ${relative}`);
}
function tarOctal(value, width) {
  const text = value.toString(8);
  if (text.length > width - 1) fail('tar numeric field overflow');
  return Buffer.from(text.padStart(width - 1, '0') + '\0', 'ascii');
}
function tarString(value, width) {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > width) fail(`tar path too long: ${value}`);
  const output = Buffer.alloc(width); bytes.copy(output); return output;
}
function tarHeader(name, size, mode = POLICY.fileMode) {
  const header = Buffer.alloc(512);
  tarString(name, 100).copy(header, 0);
  tarOctal(mode, 8).copy(header, 100);
  tarOctal(POLICY.uid, 8).copy(header, 108);
  tarOctal(POLICY.gid, 8).copy(header, 116);
  tarOctal(size, 12).copy(header, 124);
  tarOctal(POLICY.timestamps, 12).copy(header, 136);
  Buffer.from('        ').copy(header, 148);
  header[156] = '0'.charCodeAt(0);
  tarString('ustar', 6).copy(header, 257);
  tarString('00', 2).copy(header, 263);
  Buffer.from(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 'ascii').copy(header, 148);
  return header;
}
function makeTar(entries) {
  const chunks = [];
  for (const entry of entries) {
    chunks.push(tarHeader(entry.path, entry.bytes.length), entry.bytes);
    const padding = (512 - (entry.bytes.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}
async function exclusiveWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(file, 'wx');
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}

async function main() {
  const args = parseArgs(process.argv);
  const requestFile = path.resolve(args.request);
  const root = path.resolve(args.root);
  const bundleDir = path.resolve(args.bundleDir);
  const archiveFile = path.resolve(args.archive);
  const outputFile = path.resolve(args.output);
  for (const target of [bundleDir, archiveFile, outputFile]) if (await stat(target).catch(() => null)) fail(`retained output already exists: ${target}`);

  const { bytes: requestBytes, value: request } = await readJson(requestFile, 'request');
  exactKeys(request, ['schema', 'releaseName', 'evidence', 'runtimeFiles'], 'request');
  if (request.schema !== REQUEST_SCHEMA) fail(`request.schema must be ${REQUEST_SCHEMA}`);
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(request.releaseName)) fail('releaseName is invalid');
  if (!Array.isArray(request.evidence) || request.evidence.length < 1) fail('evidence must be a non-empty array');
  if (!Array.isArray(request.runtimeFiles) || request.runtimeFiles.length < 1) fail('runtimeFiles must be a non-empty array');

  const requestDir = path.dirname(requestFile);
  const evidence = [];
  const releaseBindings = new Set();
  const roles = new Set();
  for (const [index, item] of request.evidence.entries()) {
    exactKeys(item, ['role', 'path', 'schema', 'releaseIdentityPointer'], `evidence[${index}]`);
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(item.role) || roles.has(item.role)) fail(`invalid or duplicate evidence role: ${item.role}`);
    roles.add(item.role);
    const relative = safeRelative(item.path, `evidence[${index}].path`);
    const loaded = await readJson(path.join(requestDir, relative), `evidence ${item.role}`);
    if (loaded.value.schema !== item.schema) fail(`evidence ${item.role} schema mismatch`);
    const logicalIdentity = verifyLogicalIdentity(loaded.value, `evidence ${item.role}`);
    const pointer = item.releaseIdentityPointer;
    if (typeof pointer !== 'string' || !pointer.startsWith('/') || pointer.includes('~')) fail(`invalid releaseIdentityPointer for ${item.role}`);
    let bound = loaded.value;
    for (const token of pointer.slice(1).split('/')) {
      if (!token || !bound || typeof bound !== 'object' || !(token in bound)) fail(`missing release binding in ${item.role}: ${pointer}`);
      bound = bound[token];
    }
    if (typeof bound !== 'string' || bound.length === 0) fail(`release binding for ${item.role} must be a string`);
    releaseBindings.add(bound);
    evidence.push({ role: item.role, schema: item.schema, logicalIdentity, size: loaded.bytes.length, sha256: sha256(loaded.bytes), archivePath: `evidence/${item.role}.json`, bytes: loaded.bytes });
  }
  if (releaseBindings.size !== 1) fail(`cross-release evidence mismatch: ${[...releaseBindings].join(', ')}`);
  const releaseIdentity = [...releaseBindings][0];

  const runtime = [];
  const runtimePaths = new Set();
  for (const [index, item] of request.runtimeFiles.entries()) {
    exactKeys(item, ['path', 'size', 'sha256'], `runtimeFiles[${index}]`);
    const relative = safeRelative(item.path, `runtimeFiles[${index}].path`);
    if (runtimePaths.has(relative)) fail(`duplicate runtime path: ${relative}`);
    runtimePaths.add(relative);
    if (!Number.isSafeInteger(item.size) || item.size < 0) fail(`invalid size for ${relative}`);
    if (!/^[0-9a-f]{64}$/.test(item.sha256)) fail(`invalid digest for ${relative}`);
    await assertRegularNoSymlink(root, relative);
    const bytes = await readFile(path.join(root, relative));
    if (bytes.length !== item.size) fail(`runtime size mismatch: ${relative}`);
    const digest = sha256(bytes);
    if (digest !== item.sha256) fail(`runtime digest mismatch: ${relative}`);
    runtime.push({ path: relative, size: bytes.length, sha256: digest, archivePath: `runtime/${relative}`, bytes });
  }
  runtime.sort((a, b) => a.path.localeCompare(b.path));
  evidence.sort((a, b) => a.role.localeCompare(b.role));

  const install = Buffer.from([
    '#!/bin/sh', 'set -eu', 'BUNDLE_DIR=${1:?bundle directory required}', 'TARGET=${2:?target directory required}',
    '[ ! -e "$TARGET" ] || { echo "target exists" >&2; exit 1; }', 'mkdir -p "$(dirname "$TARGET")"', 'tmp="$TARGET.tmp.$$"',
    "trap 'rm -rf \"$tmp\"' EXIT INT TERM", 'mkdir -p "$tmp"', 'cp -R "$BUNDLE_DIR/runtime/." "$tmp/"', 'mv "$tmp" "$TARGET"', 'trap - EXIT INT TERM', '',
  ].join('\n'), 'utf8');
  const rollback = Buffer.from([
    '#!/bin/sh', 'set -eu', 'ACTIVE=${1:?active symlink required}', 'PREVIOUS=${2:?previous immutable release required}',
    '[ -d "$PREVIOUS" ] || { echo "previous release missing" >&2; exit 1; }', 'tmp="$ACTIVE.tmp.$$"', 'ln -s "$PREVIOUS" "$tmp"', 'mv -Tf "$tmp" "$ACTIVE"', '',
  ].join('\n'), 'utf8');

  const manifestMaterial = {
    schema: OUTPUT_SCHEMA,
    releaseName: request.releaseName,
    releaseIdentity,
    request: { size: requestBytes.length, sha256: sha256(requestBytes) },
    evidence: evidence.map(({ bytes, ...entry }) => entry),
    runtime: runtime.map(({ bytes, ...entry }) => entry),
    scripts: {
      install: { path: 'commands/install.sh', size: install.length, sha256: sha256(install) },
      rollback: { path: 'commands/rollback.sh', size: rollback.length, sha256: sha256(rollback) },
    },
    policy: POLICY,
  };
  const bundleIdentity = identity(manifestMaterial);
  const manifest = { ...manifestMaterial, identity: bundleIdentity };
  const manifestBytes = Buffer.from(`${canonical(manifest)}\n`);
  const entries = [
    ...runtime.map(entry => ({ path: entry.archivePath, bytes: entry.bytes })),
    ...evidence.map(entry => ({ path: entry.archivePath, bytes: entry.bytes })),
    { path: 'commands/install.sh', bytes: install },
    { path: 'commands/rollback.sh', bytes: rollback },
    { path: 'deployment-manifest.json', bytes: manifestBytes },
  ].sort((a, b) => a.path.localeCompare(b.path));
  const archiveBytes = makeTar(entries);
  const staging = `${bundleDir}.tmp-${process.pid}`;
  await mkdir(staging, { recursive: false });
  try {
    for (const entry of entries) {
      const destination = path.join(staging, ...entry.path.split('/'));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entry.bytes, { flag: 'wx', mode: entry.path.startsWith('commands/') ? 0o755 : 0o644 });
    }
    await rename(staging, bundleDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  await exclusiveWrite(archiveFile, archiveBytes);
  const output = {
    ...manifest,
    bundleDirectory: { manifestSha256: sha256(manifestBytes), entryCount: entries.length },
    archive: { format: 'ustar', size: archiveBytes.length, sha256: sha256(archiveBytes) },
  };
  await exclusiveWrite(outputFile, Buffer.from(`${canonical(output)}\n`));
  process.stdout.write(`${JSON.stringify({ schema: OUTPUT_SCHEMA, identity: bundleIdentity, archiveSha256: output.archive.sha256 })}\n`);
}

main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
