#!/usr/bin/env node
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, lstat, mkdir, open, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const JOURNAL_SCHEMA = 'foundation.artifact.registry.gc-journal.v2';
const INDEX_SCHEMA = 'foundation.artifact.registry.index.v1';
const AUTH_SCHEMA = 'foundation.artifact.registry.startup-recovery-authorization.v1';
const OUTPUT_SCHEMA = 'foundation.artifact.registry.startup-recovery-plan.v2';
const POLICY = Object.freeze({ version: 2, mode: 'signed-linear-supersession', activeAuthority: 'index-digest', overlapPolicy: 'reject', branchingPolicy: 'reject', cyclePolicy: 'reject', orphanPolicy: 'reject', signatureAlgorithm: 'Ed25519' });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digest = (bytes) => `sha256:${sha256(bytes)}`;
const sortValue = (value) => Array.isArray(value) ? value.map(sortValue) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])) : value;
const canonical = (value) => `${JSON.stringify(sortValue(value))}\n`;
const fail = (message) => { throw new Error(message); };

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} fields mismatch`);
}
function digestHex(value, label = 'digest') {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) fail(`invalid ${label}`);
}
function validateDigestList(value, field) {
  if (!Array.isArray(value) || new Set(value).size !== value.length) fail(`invalid ${field}`);
  for (const item of value) digestHex(item, field);
}
function validateJournal(journal) {
  exactKeys(journal, ['schema','transactionId','phase','sourceIndexSha256','targetIndexSha256','candidateDigests','moveIntents','movedDigests','createdAt'], 'journal');
  if (journal.schema !== JOURNAL_SCHEMA) fail('unsupported journal schema');
  if (!/^gc-[a-zA-Z0-9._-]{1,128}$/.test(journal.transactionId)) fail('invalid transaction id');
  if (!['prepared','quarantining','index-published','finalizing'].includes(journal.phase)) fail('invalid journal phase');
  digestHex(journal.sourceIndexSha256, 'source index digest'); digestHex(journal.targetIndexSha256, 'target index digest');
  for (const field of ['candidateDigests','moveIntents','movedDigests']) validateDigestList(journal[field], field);
  const candidates = new Set(journal.candidateDigests);
  if (!journal.moveIntents.every((item) => candidates.has(item))) fail('move intent outside candidate set');
  if (!journal.movedDigests.every((item) => candidates.has(item))) fail('moved digest outside candidate set');
  if (!journal.movedDigests.every((item) => journal.moveIntents.includes(item))) fail('moved digest without move intent');
}
function validateIndex(index) {
  exactKeys(index, ['schema','generation','releases','objects'], 'index');
  if (index.schema !== INDEX_SCHEMA) fail('unsupported index schema');
  if (!Number.isInteger(index.generation) || index.generation < 0) fail('invalid index generation');
  if (!index.releases || typeof index.releases !== 'object' || Array.isArray(index.releases)) fail('invalid releases');
  if (!index.objects || typeof index.objects !== 'object' || Array.isArray(index.objects)) fail('invalid objects');
}
function validateAuthorization(auth) {
  exactKeys(auth, ['schema','keyId','algorithm','transactions','signature'], 'authorization');
  if (auth.schema !== AUTH_SCHEMA || auth.algorithm !== 'Ed25519') fail('unsupported authorization');
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(auth.keyId)) fail('invalid key id');
  if (!Array.isArray(auth.transactions) || !auth.transactions.length) fail('authorization transactions required');
  if (new Set(auth.transactions.map((item) => item.transactionId)).size !== auth.transactions.length) fail('duplicate authorized transaction');
  for (const item of auth.transactions) {
    exactKeys(item, ['transactionId','sourceIndexSha256','targetIndexSha256','supersedes'], 'authorization transaction');
    if (!/^gc-[a-zA-Z0-9._-]{1,128}$/.test(item.transactionId)) fail('invalid authorized transaction id');
    digestHex(item.sourceIndexSha256); digestHex(item.targetIndexSha256);
    if (item.supersedes !== null && !/^gc-[a-zA-Z0-9._-]{1,128}$/.test(item.supersedes)) fail('invalid supersedes');
  }
  if (typeof auth.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(auth.signature)) fail('invalid signature encoding');
}
async function exists(path) { try { await access(path, C.F_OK); return true; } catch { return false; } }
async function readJson(path, label) {
  let bytes; try { bytes = await readFile(path); } catch { fail(`${label} missing`); }
  let value; try { value = JSON.parse(bytes); } catch { fail(`${label} invalid JSON`); }
  return { bytes, value };
}
async function listDirectories(path, label) {
  if (!(await exists(path))) return [];
  const result = [];
  for (const name of (await readdir(path)).sort()) {
    if (!/^gc-[a-zA-Z0-9._-]{1,128}$/.test(name)) fail(`unsafe ${label} entry ${name}`);
    const metadata = await lstat(join(path, name));
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(`unsupported ${label} entry ${name}`);
    result.push(name);
  }
  return result;
}
async function writeExclusive(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const directory = await open(dirname(path), 'r'); try { await directory.sync(); } finally { await directory.close(); }
}
async function loadTransaction(registry, transactionId) {
  const transactionDir = join(registry, 'transactions', transactionId);
  const journal = await readJson(join(transactionDir, 'journal.json'), `${transactionId} journal`); validateJournal(journal.value);
  if (journal.value.transactionId !== transactionId) fail(`transaction id mismatch ${transactionId}`);
  const source = await readJson(join(transactionDir, 'source-index.json'), `${transactionId} source index`);
  const target = await readJson(join(transactionDir, 'target-index.json'), `${transactionId} target index`);
  validateIndex(source.value); validateIndex(target.value);
  if (digest(source.bytes) !== journal.value.sourceIndexSha256) fail(`source index digest mismatch ${transactionId}`);
  if (digest(target.bytes) !== journal.value.targetIndexSha256) fail(`target index digest mismatch ${transactionId}`);
  return { transactionId, phase: journal.value.phase, sourceIndexSha256: journal.value.sourceIndexSha256, targetIndexSha256: journal.value.targetIndexSha256, candidateDigests: [...journal.value.candidateDigests].sort(), moveIntents: [...journal.value.moveIntents].sort(), movedDigests: [...journal.value.movedDigests].sort(), journalSha256: digest(journal.bytes), sourceGeneration: source.value.generation, targetGeneration: target.value.generation };
}
function verifyAuthorization(auth, publicKeyPem) {
  const signed = { schema: auth.schema, keyId: auth.keyId, algorithm: auth.algorithm, transactions: auth.transactions };
  let key; try { key = createPublicKey(publicKeyPem); } catch { fail('invalid public key'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('public key must be Ed25519');
  const valid = verifySignature(null, Buffer.from(canonical(signed)), key, Buffer.from(auth.signature, 'base64'));
  if (!valid) fail('authorization signature invalid');
  return { authorizationContentIdentity: digest(Buffer.from(canonical(signed))), publicKeySha256: digest(Buffer.from(publicKeyPem)) };
}
function arbitrate(transactions, auth, activeIndexSha256) {
  const byId = new Map(transactions.map((item) => [item.transactionId, item]));
  if (auth.transactions.length !== transactions.length) fail('authorization transaction set mismatch');
  const authorized = new Map(auth.transactions.map((item) => [item.transactionId, item]));
  for (const transaction of transactions) {
    const item = authorized.get(transaction.transactionId);
    if (!item) fail(`transaction not authorized ${transaction.transactionId}`);
    if (item.sourceIndexSha256 !== transaction.sourceIndexSha256 || item.targetIndexSha256 !== transaction.targetIndexSha256) fail(`authorization transition mismatch ${transaction.transactionId}`);
  }
  const candidateOwner = new Map();
  for (const transaction of transactions) for (const candidate of transaction.candidateDigests) {
    if (candidateOwner.has(candidate)) fail(`candidate overlap ${candidate}`);
    candidateOwner.set(candidate, transaction.transactionId);
  }
  const roots = auth.transactions.filter((item) => item.supersedes === null);
  if (roots.length !== 1) fail('authorization must contain one root');
  const children = new Map();
  for (const item of auth.transactions) if (item.supersedes !== null) {
    if (!authorized.has(item.supersedes)) fail(`unknown superseded transaction ${item.supersedes}`);
    if (children.has(item.supersedes)) fail(`branching supersession ${item.supersedes}`);
    children.set(item.supersedes, item.transactionId);
    const previous = authorized.get(item.supersedes);
    if (previous.targetIndexSha256 !== item.sourceIndexSha256) fail(`non-contiguous supersession ${item.transactionId}`);
  }
  const ordered = []; const seen = new Set(); let cursor = roots[0].transactionId;
  while (cursor) { if (seen.has(cursor)) fail('supersession cycle'); seen.add(cursor); ordered.push(cursor); cursor = children.get(cursor) ?? null; }
  if (ordered.length !== transactions.length) fail('disconnected supersession authorization');
  const activePositions = [];
  for (let i = 0; i < ordered.length; i++) {
    const transaction = byId.get(ordered[i]);
    if (transaction.sourceIndexSha256 === activeIndexSha256) activePositions.push({ index: i, side: 'source' });
    if (transaction.targetIndexSha256 === activeIndexSha256) activePositions.push({ index: i, side: 'target' });
  }
  const uniquePositions = activePositions.filter((item, idx, all) => idx === all.findIndex((other) => other.index === item.index && other.side === item.side));
  if (!uniquePositions.length) fail('active index disconnected from authorized chain');
  const terminal = ordered.length - 1;
  let selectedIndex;
  if (activeIndexSha256 === byId.get(ordered[terminal]).targetIndexSha256) selectedIndex = terminal;
  else {
    const sourceMatch = uniquePositions.find((item) => item.side === 'source');
    if (!sourceMatch) fail('active index has no recoverable boundary');
    selectedIndex = sourceMatch.index;
  }
  const selected = byId.get(ordered[selectedIndex]);
  const action = activeIndexSha256 === selected.targetIndexSha256 ? 'recover-post-commit' : 'recover-pre-commit';
  const archivedSuperseded = ordered.slice(0, selectedIndex);
  const blockedSuccessors = ordered.slice(selectedIndex + 1);
  if (blockedSuccessors.length) fail('authorized successor exists beyond active recovery boundary');
  return { orderedTransactionIds: ordered, archivedSupersededTransactionIds: archivedSuperseded, selectedTransactionId: selected.transactionId, action };
}
export async function planStartupRecoveryV2({ registry, authorization, publicKey, output }) {
  registry = resolve(registry); authorization = resolve(authorization); publicKey = resolve(publicKey); output = resolve(output);
  if (await exists(output)) fail('output already exists');
  const active = await readJson(join(registry, 'index.json'), 'active index'); validateIndex(active.value);
  const activeIndexSha256 = digest(active.bytes);
  const transactionIds = await listDirectories(join(registry, 'transactions'), 'transaction');
  const quarantineIds = await listDirectories(join(registry, 'quarantine'), 'quarantine');
  for (const id of quarantineIds) if (!transactionIds.includes(id)) fail(`orphan quarantine ${id}`);
  if (!transactionIds.length) fail('no abandoned transactions');
  const transactions = []; for (const id of transactionIds) transactions.push(await loadTransaction(registry, id));
  const auth = await readJson(authorization, 'authorization'); validateAuthorization(auth.value);
  const publicKeyBytes = await readFile(publicKey);
  const { authorizationContentIdentity, publicKeySha256 } = verifyAuthorization(auth.value, publicKeyBytes);
  const arbitration = arbitrate(transactions, auth.value, activeIndexSha256);
  const core = { schema: OUTPUT_SCHEMA, activeIndexSha256, authorizationContentIdentity, publicKeySha256, keyId: auth.value.keyId, action: arbitration.action, selectedTransactionId: arbitration.selectedTransactionId, orderedTransactionIds: arbitration.orderedTransactionIds, archivedSupersededTransactionIds: arbitration.archivedSupersededTransactionIds, transactions: [...transactions].sort((a,b) => a.transactionId.localeCompare(b.transactionId)), orphanQuarantines: [], policy: POLICY };
  const evidence = { ...core, identity: digest(Buffer.from(canonical(core))) };
  await writeExclusive(output, Buffer.from(canonical(evidence)));
  return evidence;
}
function parseArgs(argv) {
  const args = {}; for (let index = 2; index < argv.length; index += 2) { if (!argv[index]?.startsWith('--') || argv[index + 1] == null) fail('invalid arguments'); args[argv[index].slice(2)] = argv[index + 1]; }
  if (!args.registry || !args.authorization || !args.publicKey || !args.output) fail('usage: --registry <path> --authorization <path> --publicKey <path> --output <path>');
  return args;
}
if (import.meta.url === `file://${process.argv[1]}`) planStartupRecoveryV2(parseArgs(process.argv)).then((evidence) => process.stdout.write(`${evidence.identity}\n`), (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
