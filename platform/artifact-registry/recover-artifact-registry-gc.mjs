#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const JOURNAL_SCHEMA = 'foundation.artifact.registry.gc-journal.v1';
const INDEX_SCHEMA = 'foundation.artifact.registry.index.v1';
const OUTPUT_SCHEMA = 'foundation.artifact.registry.gc-recovery.v1';
const POLICY = Object.freeze({ version: 1, digest: 'sha256', lockIdentity: 'pid+linux-start-ticks', fsync: true });

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => `${JSON.stringify(sortValue(value))}\n`;
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortValue(value[k])]));
  return value;
}
function fail(message) { throw new Error(message); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} fields mismatch: ${actual.join(',')}`);
}
function safeDigest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) fail(`${label} must be sha256:<hex>`);
  return value.slice(7);
}
async function exists(path) { try { await access(path, fsConstants.F_OK); return true; } catch { return false; } }
async function readJson(path, label) {
  let bytes;
  try { bytes = await readFile(path); } catch { fail(`${label} missing`); }
  let value;
  try { value = JSON.parse(bytes); } catch { fail(`${label} invalid JSON`); }
  return { bytes, value };
}
async function fsyncPath(path) { const h = await open(path, 'r'); try { await h.sync(); } finally { await h.close(); } }
async function writeExclusive(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const h = await open(path, 'wx', 0o600);
  try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); }
  await fsyncPath(dirname(path));
}
async function atomicWrite(path, bytes) {
  const temp = `${path}.tmp-${process.pid}`;
  const h = await open(temp, 'wx', 0o600);
  try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); }
  await rename(temp, path);
  await fsyncPath(dirname(path));
}
async function linuxStartTicks(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
    return raw.slice(raw.lastIndexOf(')') + 2).split(' ')[19] ?? null;
  } catch { return null; }
}
async function lockOwnerAlive(lock) {
  if (!Number.isInteger(lock.pid) || lock.pid <= 0) return false;
  try { process.kill(lock.pid, 0); } catch { return false; }
  if (!lock.processStartTicks) return true;
  return (await linuxStartTicks(lock.pid)) === lock.processStartTicks;
}
function validateIndex(index) {
  exactKeys(index, ['schema', 'generation', 'releases', 'objects'], 'index');
  if (index.schema !== INDEX_SCHEMA) fail('unsupported index schema');
  if (!Number.isInteger(index.generation) || index.generation < 0) fail('invalid index generation');
  if (!index.releases || typeof index.releases !== 'object' || Array.isArray(index.releases)) fail('invalid releases');
  if (!index.objects || typeof index.objects !== 'object' || Array.isArray(index.objects)) fail('invalid objects');
}
function validateJournal(journal) {
  exactKeys(journal, ['schema', 'transactionId', 'phase', 'sourceIndexSha256', 'targetIndexSha256', 'candidateDigests', 'movedDigests', 'createdAt'], 'journal');
  if (journal.schema !== JOURNAL_SCHEMA) fail('unsupported journal schema');
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(journal.transactionId)) fail('invalid transaction id');
  if (!['prepared', 'quarantining', 'index-published', 'finalizing'].includes(journal.phase)) fail('invalid journal phase');
  safeDigest(journal.sourceIndexSha256, 'source index digest');
  safeDigest(journal.targetIndexSha256, 'target index digest');
  for (const field of ['candidateDigests', 'movedDigests']) {
    if (!Array.isArray(journal[field]) || new Set(journal[field]).size !== journal[field].length) fail(`invalid ${field}`);
    for (const digest of journal[field]) safeDigest(digest, field);
  }
  if (!journal.movedDigests.every((digest) => journal.candidateDigests.includes(digest))) fail('moved digest outside candidate set');
}
async function verifyBlob(path, digest) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`invalid blob ${digest}`);
  const bytes = await readFile(path);
  if (sha256(bytes) !== digest.slice(7)) fail(`blob digest mismatch ${digest}`);
  return bytes.length;
}
async function verifyIndexClosure(registry, index) {
  validateIndex(index);
  const referenced = new Set();
  for (const release of Object.values(index.releases)) {
    if (!release || typeof release !== 'object' || !Array.isArray(release.objects)) fail('invalid release record');
    for (const digest of release.objects) { safeDigest(digest, 'release object'); referenced.add(digest); }
  }
  for (const digest of referenced) {
    if (!index.objects[digest]) fail(`missing object metadata ${digest}`);
    const size = await verifyBlob(join(registry, 'blobs', 'sha256', digest.slice(7)), digest);
    if (index.objects[digest].size !== size) fail(`object size mismatch ${digest}`);
  }
  return [...referenced].sort();
}
async function listQuarantineDigests(path) {
  if (!(await exists(path))) return [];
  const names = await readdir(path);
  const out = [];
  for (const name of names) {
    if (!/^[0-9a-f]{64}$/.test(name)) fail(`unsafe quarantine entry ${name}`);
    const metadata = await lstat(join(path, name));
    if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`unsupported quarantine entry ${name}`);
    out.push(`sha256:${name}`);
  }
  return out.sort();
}
async function restorePreCommit(registry, sourceIndexBytes, quarantineDir) {
  const restored = [];
  for (const digest of await listQuarantineDigests(quarantineDir)) {
    const source = join(quarantineDir, digest.slice(7));
    const destination = join(registry, 'blobs', 'sha256', digest.slice(7));
    if (await exists(destination)) fail(`blob collision while restoring ${digest}`);
    await rename(source, destination);
    restored.push(digest);
  }
  await atomicWrite(join(registry, 'index.json'), sourceIndexBytes);
  await rm(quarantineDir, { recursive: true, force: true });
  return restored.sort();
}
async function finalizePostCommit(registry, targetIndex, quarantineDir) {
  const retained = await verifyIndexClosure(registry, targetIndex);
  const deleted = await listQuarantineDigests(quarantineDir);
  await rm(quarantineDir, { recursive: true, force: true });
  return { retained, deleted };
}
function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    if (!argv[index].startsWith('--') || argv[index + 1] == null) fail('invalid arguments');
    args[argv[index].slice(2)] = argv[index + 1];
  }
  return args;
}

export async function recover({ registry, output }) {
  registry = resolve(registry);
  output = resolve(output);
  if (await exists(output)) fail('output already exists');

  const journalPath = join(registry, 'transactions', 'gc-journal.json');
  const lockPath = join(registry, 'locks', 'maintenance.lock');
  const { bytes: journalBytes, value: journal } = await readJson(journalPath, 'gc journal');
  validateJournal(journal);

  if (await exists(lockPath)) {
    const { value: lock } = await readJson(lockPath, 'maintenance lock');
    if (await lockOwnerAlive(lock)) fail('maintenance lock owner is still alive');
    await rm(lockPath);
  }

  await mkdir(dirname(lockPath), { recursive: true });
  const lock = { pid: process.pid, processStartTicks: await linuxStartTicks(process.pid), transactionId: journal.transactionId };
  await writeExclusive(lockPath, canonical(lock));

  const quarantineDir = join(registry, 'quarantine', journal.transactionId);
  const sourcePath = join(registry, 'transactions', `${journal.transactionId}.source-index.json`);
  const targetPath = join(registry, 'transactions', `${journal.transactionId}.target-index.json`);

  try {
    const source = await readJson(sourcePath, 'source index');
    const target = await readJson(targetPath, 'target index');
    if (`sha256:${sha256(source.bytes)}` !== journal.sourceIndexSha256) fail('source index digest mismatch');
    if (`sha256:${sha256(target.bytes)}` !== journal.targetIndexSha256) fail('target index digest mismatch');
    validateIndex(source.value);
    validateIndex(target.value);

    const active = await readJson(join(registry, 'index.json'), 'active index');
    const activeDigest = `sha256:${sha256(active.bytes)}`;
    let action;
    let restoredDigests = [];
    let deletedDigests = [];
    let retainedDigests = [];

    if (activeDigest === journal.sourceIndexSha256 && ['prepared', 'quarantining'].includes(journal.phase)) {
      restoredDigests = await restorePreCommit(registry, source.bytes, quarantineDir);
      retainedDigests = await verifyIndexClosure(registry, source.value);
      action = 'rolled-back-pre-commit';
    } else if (activeDigest === journal.targetIndexSha256 && ['index-published', 'finalizing'].includes(journal.phase)) {
      const result = await finalizePostCommit(registry, target.value, quarantineDir);
      retainedDigests = result.retained;
      deletedDigests = result.deleted;
      action = 'finalized-post-commit';
    } else {
      fail('journal phase and active index disagree');
    }

    await rm(journalPath);
    await rm(sourcePath);
    await rm(targetPath);
    await rm(join(registry, 'transactions'), { recursive: false, force: true }).catch(() => {});

    const evidenceCore = {
      schema: OUTPUT_SCHEMA,
      transactionId: journal.transactionId,
      action,
      sourceIndexSha256: journal.sourceIndexSha256,
      targetIndexSha256: journal.targetIndexSha256,
      retainedDigests,
      restoredDigests,
      deletedDigests,
      journalSha256: `sha256:${sha256(journalBytes)}`,
      policy: POLICY
    };
    const evidence = { ...evidenceCore, identity: `sha256:${sha256(Buffer.from(canonical(evidenceCore)))}` };
    await writeExclusive(output, canonical(evidence));
    return evidence;
  } finally {
    await rm(lockPath, { force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  recover(parseArgs(process.argv))
    .then((evidence) => process.stdout.write(canonical(evidence)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
