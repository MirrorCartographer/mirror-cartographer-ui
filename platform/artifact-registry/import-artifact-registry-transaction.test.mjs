import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const executable = new URL('./import-artifact-registry-transaction.mjs', import.meta.url).pathname;
const digest = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fia-registry-'));
  const blobDir = path.join(dir, 'source-blobs');
  fs.mkdirSync(path.join(blobDir, 'sha256'), { recursive: true });
  const config = Buffer.from('{"architecture":"owned"}\n');
  const layer = Buffer.from('runtime-bytes\n');
  const configDigest = digest(config); const layerDigest = digest(layer);
  fs.writeFileSync(path.join(blobDir, 'sha256', configDigest.slice(7)), config);
  fs.writeFileSync(path.join(blobDir, 'sha256', layerDigest.slice(7)), layer);
  const objects = [
    { digest: configDigest, size: config.length, mediaType: 'application/vnd.oci.image.config.v1+json', artifactType: null, subject: null, references: [] },
    { digest: layerDigest, size: layer.length, mediaType: 'application/vnd.oci.image.layer.v1.tar', artifactType: null, subject: null, references: [] }
  ];
  const manifestBytes = Buffer.from(JSON.stringify({ config: configDigest, layers: [layerDigest] }));
  const manifestDigest = digest(manifestBytes);
  fs.writeFileSync(path.join(blobDir, 'sha256', manifestDigest.slice(7)), manifestBytes);
  objects.push({ digest: manifestDigest, size: manifestBytes.length, mediaType: 'application/vnd.oci.image.manifest.v1+json', artifactType: null, subject: null, references: [configDigest, layerDigest] });
  const canonicalCatalog = { schema: 'foundation.artifact.catalog.v1', roots: [manifestDigest], objects: objects.sort((a,b)=>a.digest.localeCompare(b.digest)) };
  const catalog = { ...canonicalCatalog, catalogDigest: digest(Buffer.from(JSON.stringify(canonicalCatalog))) };
  const catalogPath = path.join(dir, 'catalog.json'); fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  return { dir, blobDir, catalogPath, catalog, releaseIdentity: digest(Buffer.from('release-A')) };
}
function run(f, extra = {}, env = {}) {
  const registry = extra.registry ?? path.join(f.dir, 'registry');
  const output = extra.output ?? path.join(f.dir, 'transaction.json');
  const args = ['--catalog', extra.catalog ?? f.catalogPath, '--blobDir', extra.blobDir ?? f.blobDir, '--registry', registry, '--releaseIdentity', extra.releaseIdentity ?? f.releaseIdentity, '--output', output];
  const result = spawnSync(process.execPath, [executable, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { ...result, registry, output };
}

test('imports verified blobs and atomically publishes a release index', () => {
  const f = fixture(); const r = run(f); assert.equal(r.status, 0, r.stderr);
  const evidence = JSON.parse(fs.readFileSync(r.output));
  assert.equal(evidence.schema, 'foundation.artifact.registry.transaction.v1');
  assert.equal(evidence.importedDigests.length, 3);
  const index = JSON.parse(fs.readFileSync(path.join(r.registry, 'index.json')));
  assert.equal(index.generation, 1);
  assert.equal(index.releases[f.releaseIdentity].catalogDigest, f.catalog.catalogDigest);
  for (const object of f.catalog.objects) assert.ok(fs.existsSync(path.join(r.registry, 'blobs', 'sha256', object.digest.slice(7))));
});

test('equivalent independent imports produce identical evidence identities', () => {
  const a = fixture(); const b = fixture();
  const ra = run(a); const rb = run(b); assert.equal(ra.status, 0); assert.equal(rb.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(ra.output)).identity, JSON.parse(fs.readFileSync(rb.output)).identity);
});

test('rejects source blob substitution before index publication', () => {
  const f = fixture(); const object = f.catalog.objects[0];
  fs.writeFileSync(path.join(f.blobDir, 'sha256', object.digest.slice(7)), 'substituted');
  const r = run(f); assert.notEqual(r.status, 0); assert.match(r.stderr, /mismatch/);
  assert.ok(!fs.existsSync(path.join(r.registry, 'index.json')));
});

test('rejects a concurrent transaction lock without mutation', () => {
  const f = fixture(); const registry = path.join(f.dir, 'registry');
  fs.mkdirSync(path.join(registry, 'locks'), { recursive: true });
  fs.writeFileSync(path.join(registry, 'locks', 'import.lock'), 'held');
  const r = run(f, { registry }); assert.notEqual(r.status, 0); assert.match(r.stderr, /lock is already held/);
  assert.ok(!fs.existsSync(path.join(registry, 'index.json')));
});

test('same release identity cannot be rebound to another catalog', () => {
  const f = fixture(); const first = run(f); assert.equal(first.status, 0, first.stderr);
  const secondFixture = fixture();
  const changed = Buffer.from('different-runtime\n'); const d = digest(changed);
  fs.writeFileSync(path.join(secondFixture.blobDir, 'sha256', d.slice(7)), changed);
  const obj = { digest:d, size:changed.length, mediaType:'application/octet-stream', artifactType:null, subject:null, references:[] };
  const core = { schema:'foundation.artifact.catalog.v1', roots:[d], objects:[obj] };
  const catalog = { ...core, catalogDigest:digest(Buffer.from(JSON.stringify(core))) };
  const catalogPath = path.join(secondFixture.dir, 'other.json'); fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  const second = run(secondFixture, { registry:first.registry, output:path.join(secondFixture.dir,'out.json'), catalog:catalogPath, releaseIdentity:f.releaseIdentity });
  assert.notEqual(second.status, 0); assert.match(second.stderr, /different catalog/);
});

test('injected post-blob failure leaves the authoritative index unchanged', () => {
  const f = fixture(); const r = run(f, {}, { FIA_TEST_FAIL_AFTER_BLOBS:'1' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /injected failure/);
  assert.ok(!fs.existsSync(path.join(r.registry, 'index.json')));
  assert.ok(!fs.existsSync(r.output));
});

test('existing evidence prevents mutation', () => {
  const f = fixture(); const output = path.join(f.dir, 'transaction.json'); fs.writeFileSync(output, 'retained');
  const r = run(f, { output }); assert.notEqual(r.status, 0); assert.match(r.stderr, /output already exists/);
  assert.equal(fs.readFileSync(output, 'utf8'), 'retained');
  assert.ok(!fs.existsSync(path.join(r.registry, 'index.json')));
});
