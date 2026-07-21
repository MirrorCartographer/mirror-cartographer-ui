import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MANIFEST_SCHEMA = 'foundation.build.cas-publisher-manifest.v1';
const RESULT_SCHEMA = 'foundation.build.cas-publisher-reconciliation.v1';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(value) { return `sha256:${createHash('sha256').update(Buffer.isBuffer(value) || typeof value === 'string' ? value : canonical(value)).digest('hex')}`; }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function syncDir(dir) { const h = await fs.open(dir, 'r'); try { await h.sync(); } finally { await h.close(); } }
async function writeExclusiveJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); const h = await fs.open(file, 'wx', 0o600); try { await h.writeFile(`${JSON.stringify(value, null, 2)}\n`); await h.sync(); } finally { await h.close(); } await syncDir(path.dirname(file)); }
function safeRelative(value, label) { if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) throw new Error(`${label} invalid`); const parts = value.split('/'); if (parts.some(p => !p || p === '.' || p === '..')) throw new Error(`${label} unsafe`); if (value.normalize('NFC') !== value) throw new Error(`${label} noncanonical`); return value; }
async function inventory(root) {
  const out = [];
  async function walk(dir, prefix = '') {
    for (const name of (await fs.readdir(dir)).sort()) {
      const rel = prefix ? `${prefix}/${name}` : name;
      safeRelative(rel, 'staging path');
      const full = path.join(dir, name); const st = await fs.lstat(full);
      if (st.isSymbolicLink()) throw new Error(`symbolic link rejected: ${rel}`);
      if (st.isDirectory()) await walk(full, rel);
      else if (st.isFile()) { const bytes = await fs.readFile(full); out.push({ path: rel, size: bytes.length, sha256: sha256(bytes), mode: st.mode & 0o111 ? 0o755 : 0o644 }); }
      else throw new Error(`unsupported filesystem entry: ${rel}`);
    }
  }
  await walk(root); return out;
}
function inventoryIdentity(files) { return sha256(files); }
function expectedClaims(scope) { const claims = scope.claimedObjectDigests; if (!Array.isArray(claims) || !claims.length) throw new Error('claimed object closure missing'); const canonicalClaims = [...new Set(claims)].sort(); if (canonicalClaims.length !== claims.length || canonicalClaims.some((v, i) => v !== claims[i]) || canonicalClaims.some(v => !/^sha256:[0-9a-f]{64}$/.test(v))) throw new Error('claimed object closure noncanonical'); return canonicalClaims; }
function manifestAuthority(scope, files) { return { schema: MANIFEST_SCHEMA, sourceExecutionIdentity: scope.sourceExecutionIdentity, stagingIdentity: inventoryIdentity(files), files, objects: [...new Set(files.map(f => f.sha256))].sort(), policy: { claimsMatchStaging: true, objectsFsyncedBeforeManifest: true, manifestCommitBoundary: true, providerNeutral: true } }; }
async function verifyObject(file, digest, size) { const st = await fs.lstat(file); if (!st.isFile() || st.isSymbolicLink()) throw new Error(`CAS object type invalid: ${digest}`); const bytes = await fs.readFile(file); if (bytes.length !== size || sha256(bytes) !== digest) throw new Error(`CAS object mismatch: ${digest}`); }

export async function reconcilePublisher({ scope, failpoint = null }) {
  const stagingDir = scope.stagingDir; const casRoot = scope.casRoot; const manifestRel = safeRelative(scope.manifestPath, 'manifest path');
  const files = await inventory(stagingDir); if (!files.length) throw new Error('staging output empty');
  const claims = expectedClaims(scope); const observedClaims = [...new Set(files.map(f => f.sha256))].sort();
  if (canonical(claims) !== canonical(observedClaims)) throw new Error('journal claims disagree with staging output');
  const objectsDir = path.join(casRoot, 'objects', 'sha256'); const manifestPath = path.join(casRoot, manifestRel);
  if (await exists(manifestPath)) throw new Error('manifest already exists'); await fs.mkdir(objectsDir, { recursive: true });
  for (const file of files) {
    const digest = file.sha256.slice(7); const destination = path.join(objectsDir, digest); const source = path.join(stagingDir, file.path);
    if (await exists(destination)) await verifyObject(destination, file.sha256, file.size);
    else { const temp = `${destination}.tmp-${process.pid}-${randomUUID()}`; await fs.copyFile(source, temp, fs.constants.COPYFILE_EXCL); const h = await fs.open(temp, 'r'); try { await h.sync(); } finally { await h.close(); } await verifyObject(temp, file.sha256, file.size); await fs.rename(temp, destination); await syncDir(objectsDir); }
  }
  if (failpoint === 'after-objects') throw new Error('injected failure after objects');
  const after = await inventory(stagingDir); if (inventoryIdentity(after) !== inventoryIdentity(files)) throw new Error('staging changed during publication');
  const authority = manifestAuthority(scope, files); const manifest = { ...authority, identity: sha256(authority) };
  await writeExclusiveJson(manifestPath, manifest);
  if (failpoint === 'after-manifest') throw new Error('injected failure after manifest');
  const observed = await inspectPublisher({ scope });
  if (!observed.complete || observed.identity !== manifest.identity) throw new Error('committed publisher authority failed independent inspection');
  return { ok: true, identity: observed.identity, schema: RESULT_SCHEMA };
}

export async function inspectPublisher({ scope }) {
  const manifestPath = path.join(scope.casRoot, safeRelative(scope.manifestPath, 'manifest path'));
  if (!(await exists(manifestPath))) return { complete: false };
  const manifest = await readJson(manifestPath); const { identity, ...authority } = manifest;
  if (manifest.schema !== MANIFEST_SCHEMA || identity !== sha256(authority)) throw new Error('manifest identity mismatch');
  const claims = expectedClaims(scope); if (canonical(manifest.objects) !== canonical(claims)) throw new Error('manifest object closure outside signed scope');
  for (const file of manifest.files) await verifyObject(path.join(scope.casRoot, 'objects', 'sha256', file.sha256.slice(7)), file.sha256, file.size);
  return { complete: true, identity, stagingIdentity: manifest.stagingIdentity };
}
