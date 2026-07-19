import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const executable = new URL('./export-recover-artifact-registry.mjs', import.meta.url).pathname;
const digest = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fia-recovery-'));
  const registry = path.join(dir, 'registry');
  fs.mkdirSync(path.join(registry, 'blobs', 'sha256'), { recursive: true });
  const values = [Buffer.from('config\n'), Buffer.from('runtime\n'), Buffer.from('rollback\n')];
  const digests = values.map(digest);
  const blobs = {};
  for (let index = 0; index < digests.length; index++) {
    fs.writeFileSync(path.join(registry, 'blobs', 'sha256', digests[index].slice(7)), values[index]);
    blobs[digests[index]] = { size: values[index].length, mediaType: index === 2 ? 'application/vnd.fia.rollback+json' : 'application/octet-stream' };
  }
  const releaseIdentity = digest(Buffer.from('release'));
  const release = { releaseIdentity, catalogDigest: digest(Buffer.from('catalog')), catalogSha256: digest(Buffer.from('catalog-bytes')), roots: [digests[0]], objectDigests: [...digests].sort() };
  const index = { schema: 'foundation.artifact.registry.index.v1', generation: 4, releases: { [releaseIdentity]: release }, blobs };
  fs.writeFileSync(path.join(registry, 'index.json'), canonical(index) + '\n');
  return { dir, registry, releaseIdentity, digests };
}

function run(fixtureValue, extra = {}, env = {}) {
  const exportDir = extra.exportDir ?? path.join(fixtureValue.dir, 'export');
  const restoreRegistry = extra.restoreRegistry ?? path.join(fixtureValue.dir, 'restored');
  const output = extra.output ?? path.join(fixtureValue.dir, 'recovery.json');
  const result = spawnSync(process.execPath, [executable, '--registry', fixtureValue.registry, '--releaseIdentity', fixtureValue.releaseIdentity, '--exportDir', exportDir, '--restoreRegistry', restoreRegistry, '--output', output], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { ...result, exportDir, restoreRegistry, output };
}

test('exports and restores complete release authority', () => {
  const fixtureValue = fixture();
  const result = run(fixtureValue);
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(fs.readFileSync(result.output));
  assert.equal(evidence.schema, 'foundation.artifact.registry.recovery.v1');
  const index = JSON.parse(fs.readFileSync(path.join(result.restoreRegistry, 'index.json')));
  assert.deepEqual(index.releases[fixtureValue.releaseIdentity].objectDigests, [...fixtureValue.digests].sort());
  for (const objectDigest of fixtureValue.digests) assert.ok(fs.existsSync(path.join(result.restoreRegistry, 'blobs', 'sha256', objectDigest.slice(7))));
});

test('equivalent registries produce identical recovery identities', () => {
  const first = fixture();
  const second = fixture();
  const firstResult = run(first);
  const secondResult = run(second);
  assert.equal(firstResult.status, 0, firstResult.stderr);
  assert.equal(secondResult.status, 0, secondResult.stderr);
  assert.equal(JSON.parse(fs.readFileSync(firstResult.output)).identity, JSON.parse(fs.readFileSync(secondResult.output)).identity);
});

test('rejects corrupted retained CAS blob', () => {
  const fixtureValue = fixture();
  fs.writeFileSync(path.join(fixtureValue.registry, 'blobs', 'sha256', fixtureValue.digests[0].slice(7)), 'bad');
  const result = run(fixtureValue);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mismatch/);
  assert.ok(!fs.existsSync(result.output));
});

test('rejects missing indexed blob', () => {
  const fixtureValue = fixture();
  fs.rmSync(path.join(fixtureValue.registry, 'blobs', 'sha256', fixtureValue.digests[1].slice(7)));
  const result = run(fixtureValue);
  assert.notEqual(result.status, 0);
  assert.ok(!fs.existsSync(result.restoreRegistry));
});

test('exclusive export lock prevents snapshot mutation', () => {
  const fixtureValue = fixture();
  fs.mkdirSync(path.join(fixtureValue.registry, 'locks'), { recursive: true });
  fs.writeFileSync(path.join(fixtureValue.registry, 'locks', 'export.lock'), 'held');
  const result = run(fixtureValue);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lock is already held/);
  assert.ok(!fs.existsSync(result.exportDir));
});

test('injected interruption leaves no authoritative export or restore', () => {
  const fixtureValue = fixture();
  const result = run(fixtureValue, {}, { FIA_TEST_FAIL_AFTER_EXPORT_BLOBS: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injected failure/);
  assert.ok(!fs.existsSync(result.exportDir));
  assert.ok(!fs.existsSync(result.restoreRegistry));
  assert.ok(!fs.existsSync(result.output));
});

test('existing outputs prevent all mutation', () => {
  const fixtureValue = fixture();
  const output = path.join(fixtureValue.dir, 'out.json');
  fs.writeFileSync(output, 'retained');
  const result = run(fixtureValue, { output });
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(output, 'utf8'), 'retained');
  assert.ok(!fs.existsSync(result.exportDir));
  assert.ok(!fs.existsSync(result.restoreRegistry));
});
