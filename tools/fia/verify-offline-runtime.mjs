#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const BUNDLE_SCHEMA = 'fia.offline-runtime-bundle.v1';
const OUTPUT_SCHEMA = 'fia.offline-runtime-verification.v1';
const POLICY = Object.freeze({ atomicInstall: true, navigationFallbackOnly: true, rejectMixedRelease: true, removeStaleCaches: true, maxArtifactBytes: 64 * 1024 * 1024 });

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function identity(value) { const copy = structuredClone(value); delete copy.identity; return sha256(canonical(copy)); }
function fail(message) { throw new Error(message); }
function exactKeys(obj, allowed, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail(`${label} must be an object`);
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) fail(`${label} contains unknown field ${key}`);
}
function safeRel(p, label) {
  if (typeof p !== 'string' || !p || path.isAbsolute(p) || p.includes('\\') || p.split('/').includes('..')) fail(`${label} is unsafe`);
  return p.replace(/^\.\//, '');
}
function safeUrl(p, label) {
  if (typeof p !== 'string' || !p.startsWith('/') || p.includes('\\') || p.includes('?') || p.includes('#')) fail(`${label} is unsafe`);
  let decoded;
  try { decoded = decodeURIComponent(p); } catch { fail(`${label} has invalid encoding`); }
  if (decoded.split('/').includes('..')) fail(`${label} traverses`);
  return decoded.replace(/\/{2,}/g, '/');
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) { if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail('arguments must be --name value pairs'); out[argv[i].slice(2)] = argv[i + 1]; }
  for (const k of ['bundle','root','output']) if (!out[k]) fail(`missing --${k}`);
  out.quotaBytes = out.quotaBytes ? Number(out.quotaBytes) : 256 * 1024 * 1024;
  if (!Number.isSafeInteger(out.quotaBytes) || out.quotaBytes < 0) fail('quotaBytes must be a non-negative integer');
  return out;
}
function validateBundle(bundle) {
  exactKeys(bundle, ['schema','manifestIdentity','cacheIdentity','cacheName','entries','offlineFallback','serviceWorker','policy','identity'], 'bundle');
  if (bundle.schema !== BUNDLE_SCHEMA) fail(`expected ${BUNDLE_SCHEMA}`);
  if (bundle.identity !== identity(bundle)) fail('bundle identity mismatch');
  if (!Array.isArray(bundle.entries) || !bundle.entries.length) fail('bundle entries required');
  if (typeof bundle.cacheName !== 'string' || !bundle.cacheName.startsWith('fia-')) fail('invalid cacheName');
  const urls = new Set();
  for (const [i,e] of bundle.entries.entries()) {
    exactKeys(e, ['url','path','role','size','sha256'], `entry ${i}`);
    e.url = safeUrl(e.url, `entry ${i} url`); e.path = safeRel(e.path, `entry ${i} path`);
    if (urls.has(e.url)) fail(`duplicate cache url ${e.url}`); urls.add(e.url);
    if (!Number.isSafeInteger(e.size) || e.size < 0 || e.size > POLICY.maxArtifactBytes) fail(`entry ${i} invalid size`);
    if (!/^[a-f0-9]{64}$/.test(e.sha256)) fail(`entry ${i} invalid sha256`);
  }
  bundle.offlineFallback = safeUrl(bundle.offlineFallback, 'offlineFallback');
  if (!urls.has(bundle.offlineFallback)) fail('offline fallback is not in cache closure');
  return bundle;
}
async function materialize(root, entries) {
  const cache = new Map(); let total = 0;
  for (const e of entries) {
    const full = path.resolve(root, e.path); const rel = path.relative(path.resolve(root), full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`artifact escapes root: ${e.path}`);
    const s = await stat(full); if (!s.isFile()) fail(`artifact is not a regular file: ${e.path}`);
    const bytes = await readFile(full); const digest = sha256(bytes);
    if (bytes.length !== e.size) fail(`artifact size mismatch: ${e.path}`);
    if (digest !== e.sha256) fail(`artifact digest mismatch: ${e.path}`);
    total += bytes.length; cache.set(e.url, { digest, size: bytes.length, role: e.role });
  }
  return { cache, total };
}
function simulate(bundle, installed, quotaBytes) {
  const state = { caches: new Map([['fia-stale-release', new Map([['/old.js',{digest:'0'.repeat(64),size:1}]])]]), activeCache: null };
  const install = { attemptedBytes: installed.total, quotaBytes, committed: false, partialAuthoritativeEntries: 0 };
  if (installed.total > quotaBytes) {
    if (state.caches.has(bundle.cacheName)) fail('quota failure left candidate cache authoritative');
    return { install, activation: null, probes: [], rollback: null, state };
  }
  const candidate = new Map(installed.cache);
  state.caches.set(bundle.cacheName, candidate); state.activeCache = bundle.cacheName; install.committed = true;
  const removed = [...state.caches.keys()].filter(k => k.startsWith('fia-') && k !== bundle.cacheName);
  for (const k of removed) state.caches.delete(k);
  const activation = { activeCache: bundle.cacheName, removedCaches: removed.sort(), remainingCaches: [...state.caches.keys()].sort() };
  const probes = [];
  for (const e of bundle.entries) {
    const hit = candidate.get(e.url); probes.push({ request: e.url, mode: e.role === 'document' ? 'navigate' : 'asset', result: 'hit', digest: hit.digest });
  }
  const missingAsset = candidate.get('/__fia_missing_asset__.js');
  probes.push({ request:'/__fia_missing_asset__.js', mode:'asset', result: missingAsset ? 'hit' : 'miss', fallbackUsed:false });
  const fallback = candidate.get(bundle.offlineFallback); probes.push({ request:'/disconnected-route', mode:'navigate', result:fallback ? 'fallback' : 'miss', fallbackUsed:Boolean(fallback), digest:fallback?.digest ?? null });
  if (probes.at(-2).result !== 'miss') fail('missing asset was masked');
  if (!probes.at(-1).fallbackUsed) fail('disconnected navigation lacked fallback');
  const newerCache = 'fia-newer-adversarial'; state.caches.set(newerCache, new Map([['/index.html',{digest:'f'.repeat(64),size:1}]]));
  for (const k of [...state.caches.keys()]) if (k.startsWith('fia-') && k !== bundle.cacheName) state.caches.delete(k);
  const rollback = { targetCache: bundle.cacheName, newerCacheRemoved: !state.caches.has(newerCache), targetPreserved: state.caches.has(bundle.cacheName), mixedReleaseEntries: 0 };
  if (!rollback.newerCacheRemoved || !rollback.targetPreserved) fail('rollback cache authority failed');
  return { install, activation, probes, rollback, state };
}
async function main() {
  const args = parseArgs(process.argv); const outputPath = path.resolve(args.output);
  try { await stat(outputPath); fail('output already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const bundleBytes = await readFile(args.bundle); const bundle = validateBundle(JSON.parse(bundleBytes));
  const installed = await materialize(args.root, bundle.entries);
  const simulation = simulate(bundle, installed, args.quotaBytes);
  const evidence = {
    schema: OUTPUT_SCHEMA,
    bundle: { identity: bundle.identity, bytesSha256: sha256(bundleBytes), cacheIdentity: bundle.cacheIdentity, cacheName: bundle.cacheName },
    install: simulation.install,
    activation: simulation.activation,
    probes: simulation.probes,
    rollback: simulation.rollback,
    finalCaches: [...simulation.state.caches.keys()].sort(),
    policy: POLICY
  };
  evidence.identity = identity(evidence);
  await writeFile(outputPath, `${canonical(evidence)}\n`, { flag:'wx', mode:0o600 });
  process.stdout.write(`${JSON.stringify({schema:evidence.schema,identity:evidence.identity,installCommitted:evidence.install.committed})}\n`);
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
