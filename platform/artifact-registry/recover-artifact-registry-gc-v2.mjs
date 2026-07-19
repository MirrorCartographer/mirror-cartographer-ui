#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const JOURNAL_SCHEMA = 'foundation.artifact.registry.gc-journal.v2';
const INDEX_SCHEMA = 'foundation.artifact.registry.index.v1';
const OUTPUT_SCHEMA = 'foundation.artifact.registry.gc-recovery.v2';
const POLICY = Object.freeze({
  version: 2,
  digest: 'sha256',
  commitAuthority: 'active-index-digest',
  reconciliation: 'cas+quarantine-location',
  identities: 'content+operational',
  fsync: true
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sortValue = (value) => Array.isArray(value)
  ? value.map(sortValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]))
    : value;
const canonical = (value) => `${JSON.stringify(sortValue(value))}\n`;
const fail = (message) => { throw new Error(message); };

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} fields mismatch`);
}
function digestHex(value, label = 'digest') {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) fail(`invalid ${label}`);
  return value.slice(7);
}
async function exists(path) { try { await access(path, C.F_OK); return true; } catch { return false; } }
async function readJson(path, label) {
  let bytes;
  try { bytes = await readFile(path); } catch { fail(`${label} missing`); }
  let value;
  try { value = JSON.parse(bytes); } catch { fail(`${label} invalid JSON`); }
  return { bytes, value };
}
async function fsyncPath(path) { const handle = await open(path, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
async function writeExclusive(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await fsyncPath(dirname(path));
}
async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
  const handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
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
function validateDigestList(value, field) {
  if (!Array.isArray(value) || new Set(value).size !== value.length) fail(`invalid ${field}`);
  for (const item of value) digestHex(item, field);
}
function validateJournal(journal) {
  exactKeys(journal, ['schema', 'transactionId', 'phase', 'sourceIndexSha256', 'targetIndexSha256', 'candidateDigests', 'moveIntents', 'movedDigests', 'createdAt'], 'journal');
  if (journal.schema !== JOURNAL_SCHEMA) fail('unsupported journal schema');
  if (!/^gc-[a-zA-Z0-9._-]{1,128}$/.test(journal.transactionId)) fail('invalid transaction id');
  if (!['prepared', 'quarantining', 'index-published', 'finalizing'].includes(journal.phase)) fail('invalid journal phase');
  digestHex(journal.sourceIndexSha256, 'source index digest');
  digestHex(journal.targetIndexSha256, 'target index digest');
  for (const field of ['candidateDigests', 'moveIntents', 'movedDigests']) validateDigestList(journal[field], field);
  const candidates = new Set(journal.candidateDigests);
  if (!journal.moveIntents.every((item) => candidates.has(item))) fail('move intent outside candidate set');
  if (!journal.movedDigests.every((item) => candidates.has(item))) fail('moved digest outside candidate set');
  if (!journal.movedDigests.every((item) => journal.moveIntents.includes(item))) fail('moved digest without move intent');
  if (journal.phase === 'prepared' && (journal.moveIntents.length || journal.movedDigests.length)) fail('prepared journal contains move progress');
}
async function verifyBlob(path, digest, expectedSize = null) {
  const metadata = await lstat(path).catch(() => null);
  if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) fail(`invalid blob ${digest}`);
  const bytes = await readFile(path);
  if (sha256(bytes) !== digestHex(digest)) fail(`blob digest mismatch ${digest}`);
  if (expectedSize != null && expectedSize !== bytes.length) fail(`blob size mismatch ${digest}`);
  return bytes.length;
}
async function verifyIndexClosure(registry, index) {
  validateIndex(index);
  const referenced = new Set();
  for (const [releaseIdentity, release] of Object.entries(index.releases)) {
    digestHex(releaseIdentity, 'release identity');
    if (!release || typeof release !== 'object' || !Array.isArray(release.objects)) fail(`invalid release ${releaseIdentity}`);
    for (const digest of release.objects) { digestHex(digest, 'release object'); referenced.add(digest); }
  }
  for (const digest of referenced) {
    const metadata = index.objects[digest];
    if (!metadata || !Number.isInteger(metadata.size) || metadata.size < 0) fail(`missing object metadata ${digest}`);
    await verifyBlob(join(registry, 'blobs', 'sha256', digestHex(digest)), digest, metadata.size);
  }
  return [...referenced].sort();
}
async function classifyCandidate(registry, quarantineDir, digest) {
  const casPath = join(registry, 'blobs', 'sha256', digestHex(digest));
  const quarantinePath = join(quarantineDir, digestHex(digest));
  const [inCas, inQuarantine] = await Promise.all([exists(casPath), exists(quarantinePath)]);
  if (inCas && inQuarantine) fail(`candidate present in both CAS and quarantine ${digest}`);
  if (!inCas && !inQuarantine) fail(`candidate absent from CAS and quarantine ${digest}`);
  if (inCas) await verifyBlob(casPath, digest);
  if (inQuarantine) await verifyBlob(quarantinePath, digest);
  return inCas ? 'cas' : 'quarantine';
}
async function rejectUnexpectedQuarantine(quarantineDir, candidates) {
  if (!(await exists(quarantineDir))) return;
  const allowed = new Set(candidates.map(digestHex));
  for (const name of await readdir(quarantineDir)) {
    if (!/^[0-9a-f]{64}$/.test(name) || !allowed.has(name)) fail(`unexpected quarantine entry ${name}`);
    const metadata = await lstat(join(quarantineDir, name));
    if (!metadata.isFile() || metadata.isSymbolicLink()) fail(`unsupported quarantine entry ${name}`);
  }
}
async function reconcileCandidates(registry, quarantineDir, journal) {
  await rejectUnexpectedQuarantine(quarantineDir, journal.candidateDigests);
  const locations = {};
  for (const digest of journal.candidateDigests) locations[digest] = await classifyCandidate(registry, quarantineDir, digest);
  for (const digest of journal.movedDigests) {
    if (locations[digest] !== 'quarantine') fail(`journal records moved digest still in CAS ${digest}`);
  }
  for (const digest of journal.candidateDigests) {
    if (!journal.moveIntents.includes(digest) && locations[digest] === 'quarantine') fail(`candidate moved without intent ${digest}`);
  }
  return locations;
}
async function rollbackPreCommit(registry, quarantineDir, sourceIndexBytes, journal, locations) {
  const restored = [];
  for (const digest of journal.candidateDigests) {
    if (locations[digest] !== 'quarantine') continue;
    const destination = join(registry, 'blobs', 'sha256', digestHex(digest));
    if (await exists(destination)) fail(`blob collision while restoring ${digest}`);
    await rename(join(quarantineDir, digestHex(digest)), destination);
    restored.push(digest);
  }
  await fsyncPath(join(registry, 'blobs', 'sha256'));
  await atomicWrite(join(registry, 'index.json'), sourceIndexBytes);
  await rm(quarantineDir, { recursive: true, force: true });
  await fsyncPath(dirname(quarantineDir));
  return restored.sort();
}
async function finalizePostCommit(registry, quarantineDir, targetIndex, journal, locations) {
  for (const digest of journal.candidateDigests) {
    if (locations[digest] !== 'quarantine') fail(`target index active while candidate remains in CAS ${digest}`);
  }
  const retained = await verifyIndexClosure(registry, targetIndex);
  await rm(quarantineDir, { recursive: true, force: true });
  await fsyncPath(dirname(quarantineDir));
  return { retained, deleted: [...journal.candidateDigests].sort() };
}
function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] == null) fail('invalid arguments');
    args[argv[index].slice(2)] = argv[index + 1];
  }
  return args;
}

export async function recoverV2({ registry, transactionId, output }) {
  registry = resolve(registry);
  output = resolve(output);
  if (await exists(output)) fail('output already exists');
  if (!/^gc-[a-zA-Z0-9._-]{1,128}$/.test(transactionId ?? '')) fail('invalid transaction id');

  const transactionDir = join(registry, 'transactions', transactionId);
  const journalPath = join(transactionDir, 'journal.json');
  const sourcePath = join(transactionDir, 'source-index.json');
  const targetPath = join(transactionDir, 'target-index.json');
  const quarantineDir = join(registry, 'quarantine', transactionId);
  const lockPath = join(registry, 'locks', 'maintenance.lock');

  const { bytes: journalBytes, value: journal } = await readJson(journalPath, 'gc journal');
  validateJournal(journal);
  if (journal.transactionId !== transactionId) fail('transaction id mismatch');

  if (await exists(lockPath)) {
    const { value: lock } = await readJson(lockPath, 'maintenance lock');
    if (await lockOwnerAlive(lock)) fail('maintenance lock owner is still alive');
    await rm(lockPath);
  }
  const operationalId = `recovery-${randomBytes(8).toString('hex')}`;
  await writeExclusive(lockPath, Buffer.from(canonical({ pid: process.pid, processStartTicks: await linuxStartTicks(process.pid), transactionId, operationalId })));

  try {
    const source = await readJson(sourcePath, 'source index');
    const target = await readJson(targetPath, 'target index');
    if (`sha256:${sha256(source.bytes)}` !== journal.sourceIndexSha256) fail('source index digest mismatch');
    if (`sha256:${sha256(target.bytes)}` !== journal.targetIndexSha256) fail('target index digest mismatch');
    validateIndex(source.value);
    validateIndex(target.value);

    const active = await readJson(join(registry, 'index.json'), 'active index');
    const activeDigest = `sha256:${sha256(active.bytes)}`;
    if (![journal.sourceIndexSha256, journal.targetIndexSha256].includes(activeDigest)) fail('active index matches neither source nor target');

    const locations = await reconcileCandidates(registry, quarantineDir, journal);
    let action;
    let restoredDigests = [];
    let deletedDigests = [];
    let retainedDigests = [];

    if (activeDigest === journal.sourceIndexSha256) {
      restoredDigests = await rollbackPreCommit(registry, quarantineDir, source.bytes, journal, locations);
      retainedDigests = await verifyIndexClosure(registry, source.value);
      action = 'rolled-back-pre-commit';
    } else {
      const result = await finalizePostCommit(registry, quarantineDir, target.value, journal, locations);
      retainedDigests = result.retained;
      deletedDigests = result.deleted;
      action = 'finalized-post-commit';
    }

    await rm(transactionDir, { recursive: true, force: true });
    await fsyncPath(dirname(transactionDir));

    const contentCore = {
      schema: OUTPUT_SCHEMA,
      transactionId,
      action,
      sourceIndexSha256: journal.sourceIndexSha256,
      targetIndexSha256: journal.targetIndexSha256,
      retainedDigests,
      restoredDigests,
      deletedDigests,
      reconciledLocations: Object.fromEntries(Object.entries(locations).sort()),
      journalSha256: `sha256:${sha256(journalBytes)}`,
      policy: POLICY
    };
    const contentIdentity = `sha256:${sha256(Buffer.from(canonical(contentCore)))}`;
    const operationalCore = { contentIdentity, operationalId };
    const evidence = { ...contentCore, contentIdentity, operationalId, identity: `sha256:${sha256(Buffer.from(canonical(operationalCore)))}` };
    await writeExclusive(output, Buffer.from(canonical(evidence)));
    return evidence;
  } finally {
    await rm(lockPath, { force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  recoverV2(parseArgs(process.argv))
    .then((evidence) => process.stdout.write(canonical(evidence)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
