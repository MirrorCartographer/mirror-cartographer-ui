#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SCHEMA = 'fia.owned-registry-import.v1';
const REGISTERED_SCHEMA = 'fia.registered-owned-build.v1';
const HEX64 = /^[a-f0-9]{64}$/;

function fail(message) { throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function logicalIdentity(record) {
  const clone = structuredClone(record);
  delete clone.identity;
  return sha256(Buffer.from(canonical(clone)));
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key?.startsWith('--') || val === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = val;
  }
  for (const key of ['registered','registryDir','output']) if (!out[key]) fail(`missing --${key}`);
  return out;
}
function safeRelative(p, label) {
  if (typeof p !== 'string' || !p || path.isAbsolute(p)) fail(`${label} must be a non-empty relative path`);
  const n = path.posix.normalize(p.replaceAll('\\','/'));
  if (n === '..' || n.startsWith('../')) fail(`${label} escapes its root`);
  return n;
}
async function readJson(file) {
  const bytes = await fs.readFile(file);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(`invalid JSON: ${file}`); }
  return { bytes, value };
}
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true, mode: 0o755 }); }
async function atomicWrite(file, bytes) {
  await ensureDir(path.dirname(file));
  try {
    const existing = await fs.readFile(file);
    if (!existing.equals(bytes)) fail(`conflicting existing registry object: ${file}`);
    return 'existing-identical';
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const handle = await fs.open(tmp, 'wx', 0o444);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(tmp, file);
  const dirHandle = await fs.open(path.dirname(file), 'r');
  try { await dirHandle.sync(); } finally { await dirHandle.close(); }
  return 'written';
}
async function writeExclusive(file, bytes) {
  await ensureDir(path.dirname(file));
  const h = await fs.open(file, 'wx', 0o444);
  try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); }
}
async function inventoryTree(root) {
  const entries = [];
  async function walk(dir, rel='') {
    const names = (await fs.readdir(dir, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name));
    for (const d of names) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      const p = path.join(dir, d.name);
      const st = await fs.lstat(p);
      if (st.isSymbolicLink()) fail(`symlink forbidden in registry: ${r}`);
      if (st.isDirectory()) { entries.push({path:r,type:'directory',mode:st.mode & 0o777}); await walk(p,r); }
      else if (st.isFile()) { const b=await fs.readFile(p); entries.push({path:r,type:'file',mode:st.mode & 0o777,size:b.length,sha256:sha256(b)}); }
      else fail(`unsupported registry entry: ${r}`);
    }
  }
  await walk(root);
  return entries;
}
function normalizeDigest(v,label) {
  if (typeof v !== 'string') fail(`${label} digest missing`);
  const h = v.startsWith('sha256:') ? v.slice(7) : v;
  if (!HEX64.test(h)) fail(`${label} digest invalid`);
  return h;
}
function validateRegistered(r) {
  if (r.schema !== REGISTERED_SCHEMA) fail(`expected ${REGISTERED_SCHEMA}`);
  if (r.identity !== logicalIdentity(r)) fail('registered build identity mismatch');
  if (!Array.isArray(r.objects) || r.objects.length === 0) fail('registered build objects missing');
  if (!r.release || typeof r.release.name !== 'string') fail('registered release name missing');
  const name = safeRelative(r.release.name, 'release name');
  if (name.includes('/')) fail('release name must be one path segment');
  const seen = new Set();
  const objects = r.objects.map((o,i) => {
    const digest = normalizeDigest(o.digest, `object ${i}`);
    if (seen.has(digest)) fail(`duplicate object digest: ${digest}`);
    seen.add(digest);
    const sourcePath = safeRelative(o.path, `object ${i} path`);
    if (!Number.isSafeInteger(o.size) || o.size < 0) fail(`object ${i} size invalid`);
    return {digest, sourcePath, size:o.size, role:String(o.role ?? 'object'), mediaType:String(o.mediaType ?? 'application/octet-stream')};
  }).sort((a,b)=>a.digest.localeCompare(b.digest));
  for (const field of ['catalog','export','rollback']) {
    const list = r[field]?.objectDigests;
    if (!Array.isArray(list) || list.length === 0) fail(`${field} objectDigests missing`);
    for (const d of list) if (!seen.has(normalizeDigest(d, `${field} object`))) fail(`${field} references unavailable object ${d}`);
  }
  const exportSet = new Set(r.export.objectDigests.map(d=>normalizeDigest(d,'export object')));
  if (exportSet.size !== seen.size || objects.some(o=>!exportSet.has(o.digest))) fail('export manifest is not complete');
  const rollbackSet = new Set(r.rollback.objectDigests.map(d=>normalizeDigest(d,'rollback object')));
  const runtime = objects.filter(o=>o.role==='runtime');
  if (runtime.length !== 1 || !rollbackSet.has(runtime[0].digest)) fail('rollback manifest must retain the single runtime object');
  return {name, objects};
}

async function main() {
  const args = parseArgs(process.argv);
  const registeredPath = path.resolve(args.registered);
  const sourceRoot = path.dirname(registeredPath);
  const registryDir = path.resolve(args.registryDir);
  const output = path.resolve(args.output);
  try { await fs.access(output); fail('output evidence already exists'); } catch(e) { if (e.code !== 'ENOENT') throw e; }
  const {bytes:registeredBytes,value:registered} = await readJson(registeredPath);
  const {name,objects} = validateRegistered(registered);
  await ensureDir(registryDir);
  const operations = [];
  for (const o of objects) {
    const source = path.resolve(sourceRoot,o.sourcePath);
    if (!source.startsWith(sourceRoot + path.sep)) fail(`object path escapes source root: ${o.sourcePath}`);
    const st = await fs.lstat(source);
    if (!st.isFile() || st.isSymbolicLink()) fail(`object must be a regular file: ${o.sourcePath}`);
    const bytes = await fs.readFile(source);
    if (bytes.length !== o.size) fail(`object size mismatch: ${o.sourcePath}`);
    if (sha256(bytes) !== o.digest) fail(`object digest mismatch: ${o.sourcePath}`);
    const target = path.join(registryDir,'objects','sha256',o.digest.slice(0,2),o.digest);
    const result = await atomicWrite(target,bytes);
    operations.push({digest:o.digest,role:o.role,size:o.size,objectPath:path.relative(registryDir,target).replaceAll('\\','/'),result});
  }
  const catalog = {
    schema:'fia.owned-registry-catalog.v1', registeredBuildIdentity:registered.identity,
    release:name, objects:objects.map(o=>({digest:`sha256:${o.digest}`,size:o.size,role:o.role,mediaType:o.mediaType})),
  };
  catalog.identity = logicalIdentity(catalog);
  const catalogBytes = Buffer.from(`${canonical(catalog)}\n`);
  const catalogDigest = sha256(catalogBytes);
  await atomicWrite(path.join(registryDir,'manifests','sha256',`${catalogDigest}.json`),catalogBytes);
  const releasePointer = {
    schema:'fia.owned-release-pointer.v1', release:name, registeredBuildIdentity:registered.identity,
    catalogDigest:`sha256:${catalogDigest}`, rollbackIdentity:registered.rollback.identity ?? null,
  };
  releasePointer.identity = logicalIdentity(releasePointer);
  const pointerBytes = Buffer.from(`${canonical(releasePointer)}\n`);
  const pointerPath = path.join(registryDir,'releases',name,`${registered.identity}.json`);
  await atomicWrite(pointerPath,pointerBytes);

  const exportDir = path.join(registryDir,'exports',registered.identity);
  await ensureDir(exportDir);
  for (const op of operations) {
    const src = path.join(registryDir,op.objectPath);
    const dst = path.join(exportDir,op.objectPath);
    await atomicWrite(dst,await fs.readFile(src));
  }
  await atomicWrite(path.join(exportDir,'catalog.json'),catalogBytes);
  await atomicWrite(path.join(exportDir,'release-pointer.json'),pointerBytes);
  const exportManifest = {
    schema:'fia.owned-registry-export.v1', registeredBuildIdentity:registered.identity,
    catalogDigest:`sha256:${catalogDigest}`, releasePointerIdentity:releasePointer.identity,
    objects:operations.map(o=>({digest:`sha256:${o.digest}`,size:o.size,path:o.objectPath})),
  };
  exportManifest.identity=logicalIdentity(exportManifest);
  const exportBytes=Buffer.from(`${canonical(exportManifest)}\n`);
  await atomicWrite(path.join(exportDir,'export-manifest.json'),exportBytes);

  const restoreDir = path.join(registryDir,'.restore-verification',registered.identity);
  try { await fs.rm(restoreDir,{recursive:true,force:true}); } catch {}
  await ensureDir(restoreDir);
  const parsedExport=JSON.parse((await fs.readFile(path.join(exportDir,'export-manifest.json'))).toString('utf8'));
  if (parsedExport.identity !== logicalIdentity(parsedExport)) fail('export manifest identity mismatch during restore');
  for (const obj of parsedExport.objects) {
    const d=normalizeDigest(obj.digest,'restore object');
    const source=path.join(exportDir,safeRelative(obj.path,'restore path'));
    const b=await fs.readFile(source);
    if (b.length!==obj.size || sha256(b)!==d) fail(`restore source mismatch: ${d}`);
    await atomicWrite(path.join(restoreDir,'objects','sha256',d.slice(0,2),d),b);
  }
  const restored = (await inventoryTree(path.join(restoreDir,'objects'))).filter(entry => entry.type === 'file');
  const expected = operations.map(o=>({path:`sha256/${o.digest.slice(0,2)}/${o.digest}`,type:'file',mode:0o444,size:o.size,sha256:o.digest})).sort((a,b)=>a.path.localeCompare(b.path));
  if (canonical(restored)!==canonical(expected)) fail('clean restore inventory mismatch');
  await fs.rm(restoreDir,{recursive:true,force:true});

  const evidence = {
    schema:SCHEMA,
    registeredBuild:{identity:registered.identity,sha256:sha256(registeredBytes),size:registeredBytes.length},
    release:{name,pointerIdentity:releasePointer.identity,pointerPath:path.relative(registryDir,pointerPath).replaceAll('\\','/')},
    catalog:{identity:catalog.identity,digest:`sha256:${catalogDigest}`},
    export:{identity:exportManifest.identity,path:path.relative(registryDir,exportDir).replaceAll('\\','/'),cleanRestoreVerified:true},
    objects:operations,
    policy:{contentAddressed:true,atomicWrites:true,conflictingDigestBytesRejected:true,appendOnlyReleasePointer:true,completeOfflineExport:true,cleanHostRestoreVerified:true,hostedRegistryAuthority:false}
  };
  evidence.identity=logicalIdentity(evidence);
  await writeExclusive(output,Buffer.from(`${canonical(evidence)}\n`));
  process.stdout.write(`${JSON.stringify({schema:evidence.schema,identity:evidence.identity,catalogDigest:evidence.catalog.digest,objects:evidence.objects.length})}\n`);
}
main().catch(e=>{ console.error(e.message); process.exitCode=1; });
