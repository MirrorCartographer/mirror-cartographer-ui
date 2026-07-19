#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SCHEMA = 'foundation.artifact.registry.transaction.v1';
const INDEX_SCHEMA = 'foundation.artifact.registry.index.v1';
const CATALOG_SCHEMA = 'foundation.artifact.catalog.v1';
const DIGEST_RE = /^sha256:([0-9a-f]{64})$/;

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeExclusive(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function atomicWrite(file, bytes, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const fd = fs.openSync(tmp, 'wx', mode);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  const dfd = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
}
function assertExactKeys(obj, allowed, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${label} must be an object`);
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) throw new Error(`${label} has unknown field ${key}`);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value == null) throw new Error('usage: import-artifact-registry-transaction.mjs --catalog FILE --blobDir DIR --registry DIR --releaseIdentity sha256:... --output FILE');
    out[key.slice(2)] = value;
  }
  for (const key of ['catalog','blobDir','registry','releaseIdentity','output']) if (!out[key]) throw new Error(`missing --${key}`);
  return out;
}
function verifyCatalog(catalog) {
  assertExactKeys(catalog, ['schema','roots','objects','catalogDigest'], 'catalog');
  if (catalog.schema !== CATALOG_SCHEMA) throw new Error(`unsupported catalog schema ${catalog.schema}`);
  if (!Array.isArray(catalog.roots) || !Array.isArray(catalog.objects)) throw new Error('catalog roots and objects must be arrays');
  const digest = sha256(Buffer.from(JSON.stringify({ schema: catalog.schema, roots: catalog.roots, objects: catalog.objects })));
  if (catalog.catalogDigest !== digest) throw new Error(`catalog digest mismatch: expected ${digest}`);
  const byDigest = new Map();
  for (const object of catalog.objects) {
    assertExactKeys(object, ['digest','size','mediaType','artifactType','subject','references'], 'catalog object');
    if (!DIGEST_RE.test(object.digest)) throw new Error(`invalid digest ${object.digest}`);
    if (byDigest.has(object.digest)) throw new Error(`duplicate object ${object.digest}`);
    if (!Number.isInteger(object.size) || object.size < 0) throw new Error(`invalid size ${object.digest}`);
    if (typeof object.mediaType !== 'string' || object.mediaType.length === 0) throw new Error(`invalid mediaType ${object.digest}`);
    if (!Array.isArray(object.references)) throw new Error(`invalid references ${object.digest}`);
    byDigest.set(object.digest, object);
  }
  const roots = [...catalog.roots];
  if (new Set(roots).size !== roots.length) throw new Error('duplicate catalog roots');
  for (const root of roots) if (!byDigest.has(root)) throw new Error(`missing root ${root}`);
  for (const object of byDigest.values()) {
    for (const child of object.references) if (!byDigest.has(child)) throw new Error(`missing referenced object ${child}`);
    if (object.subject && !byDigest.has(object.subject)) throw new Error(`missing subject ${object.subject}`);
  }
  const reachable = new Set();
  const visit = digestValue => {
    if (reachable.has(digestValue)) return;
    reachable.add(digestValue);
    for (const child of byDigest.get(digestValue).references) visit(child);
  };
  for (const root of roots) visit(root);
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of byDigest.values()) {
      if (object.subject && reachable.has(object.subject) && !reachable.has(object.digest)) { visit(object.digest); changed = true; }
    }
  }
  if (reachable.size !== byDigest.size) {
    const unreachable = [...byDigest.keys()].filter(d => !reachable.has(d)).sort();
    throw new Error(`catalog contains unreachable objects: ${unreachable.join(',')}`);
  }
  return { byDigest, roots };
}
function blobPath(root, digest) { return path.join(root, 'sha256', DIGEST_RE.exec(digest)[1]); }
function verifyBlob(file, object) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`blob is not a regular file ${object.digest}`);
  if (stat.size !== object.size) throw new Error(`blob size mismatch ${object.digest}`);
  const bytes = fs.readFileSync(file);
  const actual = sha256(bytes);
  if (actual !== object.digest) throw new Error(`blob digest mismatch ${object.digest}: got ${actual}`);
  return bytes;
}
function emptyIndex() { return { schema: INDEX_SCHEMA, generation: 0, releases: {}, blobs: {} }; }
function loadIndex(file) {
  if (!fs.existsSync(file)) return emptyIndex();
  const index = readJson(file);
  assertExactKeys(index, ['schema','generation','releases','blobs'], 'registry index');
  if (index.schema !== INDEX_SCHEMA || !Number.isInteger(index.generation) || index.generation < 0) throw new Error('invalid registry index');
  if (!index.releases || typeof index.releases !== 'object' || Array.isArray(index.releases)) throw new Error('invalid releases index');
  if (!index.blobs || typeof index.blobs !== 'object' || Array.isArray(index.blobs)) throw new Error('invalid blobs index');
  return index;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!DIGEST_RE.test(args.releaseIdentity)) throw new Error('releaseIdentity must be sha256 digest');
  if (fs.existsSync(args.output)) throw new Error(`output already exists: ${args.output}`);
  const catalogBytes = fs.readFileSync(args.catalog);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const { byDigest, roots } = verifyCatalog(catalog);
  const registry = path.resolve(args.registry);
  const lockDir = path.join(registry, 'locks');
  const lockFile = path.join(lockDir, 'import.lock');
  fs.mkdirSync(lockDir, { recursive: true });
  let lockFd;
  try {
    lockFd = fs.openSync(lockFile, 'wx', 0o600);
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, releaseIdentity: args.releaseIdentity }) + '\n');
    fs.fsyncSync(lockFd);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('registry import lock is already held');
    throw error;
  }
  try {
    const indexFile = path.join(registry, 'index.json');
    const index = loadIndex(indexFile);
    const prior = index.releases[args.releaseIdentity];
    if (prior && prior.catalogDigest !== catalog.catalogDigest) throw new Error('release identity already points to a different catalog');
    const imported = [];
    const reused = [];
    const nextBlobs = { ...index.blobs };
    for (const digest of [...byDigest.keys()].sort()) {
      const object = byDigest.get(digest);
      const source = blobPath(path.resolve(args.blobDir), digest);
      const bytes = verifyBlob(source, object);
      const target = blobPath(path.join(registry, 'blobs'), digest);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (fs.existsSync(target)) {
        verifyBlob(target, object);
        reused.push(digest);
      } else {
        const tmp = `${target}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
        const fd = fs.openSync(tmp, 'wx', 0o444);
        try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        try { fs.renameSync(tmp, target); } catch (error) { fs.rmSync(tmp, { force: true }); throw error; }
        imported.push(digest);
      }
      const current = nextBlobs[digest];
      const metadata = { size: object.size, mediaType: object.mediaType };
      if (current && canonical(current) !== canonical(metadata)) throw new Error(`registry metadata collision ${digest}`);
      nextBlobs[digest] = metadata;
    }
    if (process.env.FIA_TEST_FAIL_AFTER_BLOBS === '1') throw new Error('injected failure after blob import');
    const releaseRecord = {
      releaseIdentity: args.releaseIdentity,
      catalogDigest: catalog.catalogDigest,
      catalogSha256: sha256(catalogBytes),
      roots: [...roots].sort(),
      objectDigests: [...byDigest.keys()].sort()
    };
    const nextReleases = { ...index.releases, [args.releaseIdentity]: releaseRecord };
    const nextIndex = { schema: INDEX_SCHEMA, generation: index.generation + 1, releases: nextReleases, blobs: nextBlobs };
    const indexBytes = Buffer.from(canonical(nextIndex) + '\n');
    atomicWrite(indexFile, indexBytes, 0o600);
    const transactionCore = {
      schema: SCHEMA,
      releaseIdentity: args.releaseIdentity,
      catalogDigest: catalog.catalogDigest,
      catalogSha256: sha256(catalogBytes),
      registryIndexSha256: sha256(indexBytes),
      registryGeneration: nextIndex.generation,
      roots: releaseRecord.roots,
      objectDigests: releaseRecord.objectDigests,
      importedDigests: imported,
      reusedDigests: reused,
      policy: {
        digestAlgorithm: 'sha256',
        exclusiveLock: true,
        blobsContentAddressed: true,
        releaseIdentityImmutable: true,
        indexAtomicReplace: true,
        evidenceExclusiveCreate: true
      }
    };
    const evidence = { ...transactionCore, identity: sha256(Buffer.from(canonical(transactionCore))) };
    writeExclusive(path.resolve(args.output), Buffer.from(canonical(evidence) + '\n'));
    console.log(evidence.identity);
  } finally {
    if (lockFd !== undefined) fs.closeSync(lockFd);
    fs.rmSync(lockFile, { force: true });
  }
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
