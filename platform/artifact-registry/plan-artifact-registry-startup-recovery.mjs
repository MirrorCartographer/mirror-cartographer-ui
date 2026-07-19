#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants as C } from 'node:fs';
import { access, lstat, mkdir, open, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const JOURNAL_SCHEMA = 'foundation.artifact.registry.gc-journal.v2';
const INDEX_SCHEMA = 'foundation.artifact.registry.index.v1';
const OUTPUT_SCHEMA = 'foundation.artifact.registry.startup-recovery-plan.v1';
const POLICY = Object.freeze({ version: 1, mode: 'fail-closed-planning', activeAuthority: 'index-digest', overlapPolicy: 'reject', disconnectedPolicy: 'reject', orphanPolicy: 'reject', automaticRecoveryLimit: 1 });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sortValue = (value) => Array.isArray(value) ? value.map(sortValue) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])])) : value;
const canonical = (value) => `${JSON.stringify(sortValue(value))}\n`;
const fail = (message) => { throw new Error(message); };
const digest = (bytes) => `sha256:${sha256(bytes)}`;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} fields mismatch`);
}
function digestHex(value, label = 'digest') {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) fail(`invalid ${label}`);
  return value.slice(7);
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
function validateIndex(index) {
  exactKeys(index, ['schema', 'generation', 'releases', 'objects'], 'index');
  if (index.schema !== INDEX_SCHEMA) fail('unsupported index schema');
  if (!Number.isInteger(index.generation) || index.generation < 0) fail('invalid index generation');
  if (!index.releases || typeof index.releases !== 'object' || Array.isArray(index.releases)) fail('invalid releases');
  if (!index.objects || typeof index.objects !== 'object' || Array.isArray(index.objects)) fail('invalid objects');
}
async function exists(path) { try { await access(path, C.F_OK); return true; } catch { return false; } }
async function readJson(path, label) {
  let bytes;
  try { bytes = await readFile(path); } catch { fail(`${label} missing`); }
  let value;
  try { value = JSON.parse(bytes); } catch { fail(`${label} invalid JSON`); }
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
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
async function loadTransaction(registry, transactionId) {
  const transactionDir = join(registry, 'transactions', transactionId);
  const journal = await readJson(join(transactionDir, 'journal.json'), `${transactionId} journal`);
  validateJournal(journal.value);
  if (journal.value.transactionId !== transactionId) fail(`transaction id mismatch ${transactionId}`);
  const source = await readJson(join(transactionDir, 'source-index.json'), `${transactionId} source index`);
  const target = await readJson(join(transactionDir, 'target-index.json'), `${transactionId} target index`);
  validateIndex(source.value); validateIndex(target.value);
  if (digest(source.bytes) !== journal.value.sourceIndexSha256) fail(`source index digest mismatch ${transactionId}`);
  if (digest(target.bytes) !== journal.value.targetIndexSha256) fail(`target index digest mismatch ${transactionId}`);
  if (journal.value.sourceIndexSha256 === journal.value.targetIndexSha256) fail(`no-op index transition ${transactionId}`);
  return { transactionId, phase: journal.value.phase, sourceIndexSha256: journal.value.sourceIndexSha256, targetIndexSha256: journal.value.targetIndexSha256, candidateDigests: [...journal.value.candidateDigests].sort(), moveIntents: [...journal.value.moveIntents].sort(), movedDigests: [...journal.value.movedDigests].sort(), journalSha256: digest(journal.bytes), sourceGeneration: source.value.generation, targetGeneration: target.value.generation };
}
function validateTransitionGraph(transactions) {
  const bySource = new Map(); const byTarget = new Map(); const candidateOwner = new Map();
  for (const transaction of transactions) {
    if (bySource.has(transaction.sourceIndexSha256)) fail(`multiple transactions share source index ${transaction.sourceIndexSha256}`);
    if (byTarget.has(transaction.targetIndexSha256)) fail(`multiple transactions share target index ${transaction.targetIndexSha256}`);
    bySource.set(transaction.sourceIndexSha256, transaction.transactionId); byTarget.set(transaction.targetIndexSha256, transaction.transactionId);
    for (const candidate of transaction.candidateDigests) {
      if (candidateOwner.has(candidate)) fail(`candidate overlap ${candidate}`);
      candidateOwner.set(candidate, transaction.transactionId);
    }
  }
  for (const transaction of transactions) {
    const seen = new Set([transaction.sourceIndexSha256]); let cursor = transaction.targetIndexSha256;
    while (bySource.has(cursor)) {
      if (seen.has(cursor)) fail('index transition cycle');
      seen.add(cursor);
      cursor = transactions.find((item) => item.transactionId === bySource.get(cursor)).targetIndexSha256;
    }
  }
}
export async function planStartupRecovery({ registry, output }) {
  registry = resolve(registry); output = resolve(output);
  if (await exists(output)) fail('output already exists');
  const active = await readJson(join(registry, 'index.json'), 'active index'); validateIndex(active.value);
  const activeIndexSha256 = digest(active.bytes);
  const transactionIds = await listDirectories(join(registry, 'transactions'), 'transaction');
  const quarantineIds = await listDirectories(join(registry, 'quarantine'), 'quarantine');
  for (const id of quarantineIds) if (!transactionIds.includes(id)) fail(`orphan quarantine ${id}`);
  for (const id of transactionIds) if (!quarantineIds.includes(id)) {
    const journal = await readJson(join(registry, 'transactions', id, 'journal.json'), `${id} journal`); validateJournal(journal.value);
    if (journal.value.moveIntents.length || journal.value.movedDigests.length) fail(`transaction progress without quarantine ${id}`);
  }
  const transactions = [];
  for (const id of transactionIds) transactions.push(await loadTransaction(registry, id));
  validateTransitionGraph(transactions);
  const activeMatches = transactions.filter((item) => [item.sourceIndexSha256, item.targetIndexSha256].includes(activeIndexSha256));
  if (activeMatches.length > 1) fail('active index ambiguously matches multiple transactions');
  if (transactions.length > 1) fail('multiple abandoned transactions require explicit arbitration');
  if (transactions.length === 1 && activeMatches.length !== 1) fail('abandoned transaction disconnected from active index');
  const selected = activeMatches[0] ?? null;
  const action = !selected ? 'no-recovery-required' : selected.sourceIndexSha256 === activeIndexSha256 ? 'recover-pre-commit' : 'recover-post-commit';
  const core = { schema: OUTPUT_SCHEMA, activeIndexSha256, action, selectedTransactionId: selected?.transactionId ?? null, transactions, orphanQuarantines: [], policy: POLICY };
  const evidence = { ...core, identity: digest(Buffer.from(canonical(core))) };
  await writeExclusive(output, Buffer.from(canonical(evidence)));
  return evidence;
}
function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] == null) fail('invalid arguments');
    args[argv[index].slice(2)] = argv[index + 1];
  }
  if (!args.registry || !args.output) fail('usage: --registry <path> --output <path>');
  return args;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  planStartupRecovery(parseArgs(process.argv)).then((evidence) => process.stdout.write(`${evidence.identity}\n`), (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
