import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = new URL('./seal-release-evidence.mjs', import.meta.url).pathname;
const canonical = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const identified = (record) => ({ ...record, identity: sha(Buffer.from(canonical(record))) });

async function writeFixture(records) {
  const { dir } = records;
  for (const name of ['bundle', 'sbom', 'provenance']) await writeFile(path.join(dir, `${name}.json`), `${canonical(records[name])}\n`);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  await writeFile(path.join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  await writeFile(path.join(dir, 'public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
}

function run(dir, action = 'seal') {
  const args = [tool, '--action', action, '--bundleManifest', path.join(dir, 'bundle.json'), '--sbom', path.join(dir, 'sbom.json'), '--provenance', path.join(dir, 'provenance.json'), '--publicKey', path.join(dir, 'public.pem')];
  if (action === 'seal') args.push('--privateKey', path.join(dir, 'private.pem'), '--output', path.join(dir, 'seal.json'));
  else args.push('--seal', path.join(dir, 'seal.json'));
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'fia-seal-'));
  const sourceCommit = 'a'.repeat(40);
  const sbom = identified({ schema: 'fia.cyclonedx-sbom.v1', sourceCommit, components: [] });
  const bundleAnchor = { schema: 'fia.portable-runtime-bundle.v1', sbomIdentity: sbom.identity, objects: [] };
  const bundleAnchorIdentity = sha(Buffer.from(canonical(bundleAnchor)));
  const provenance = identified({ schema: 'fia.release-provenance.v1', sourceCommit, sbomIdentity: sbom.identity, bundleIdentity: bundleAnchorIdentity, subject: 'artifact' });
  const bundle = identified({ ...bundleAnchor, provenanceIdentity: provenance.identity, bundleAnchorIdentity });
  await writeFixture({ dir, bundle, sbom, provenance });
  return { dir, bundle, sbom, provenance };
}

test('seals and verifies exact evidence bytes', async () => {
  const f = await fixture();
  let result = run(f.dir);
  assert.equal(result.status, 0, result.stderr);
  result = run(f.dir, 'verify');
  assert.equal(result.status, 0, result.stderr);
});

test('rejects SBOM substitution', async () => {
  const f = await fixture();
  assert.equal(run(f.dir).status, 0);
  const changed = identified({ schema: 'fia.cyclonedx-sbom.v1', sourceCommit: 'b'.repeat(40), components: [] });
  await writeFile(path.join(f.dir, 'sbom.json'), `${canonical(changed)}\n`);
  assert.notEqual(run(f.dir, 'verify').status, 0);
});

test('rejects provenance substitution', async () => {
  const f = await fixture();
  assert.equal(run(f.dir).status, 0);
  const changed = identified({ ...f.provenance, subject: 'other' });
  await writeFile(path.join(f.dir, 'provenance.json'), `${canonical(changed)}\n`);
  assert.notEqual(run(f.dir, 'verify').status, 0);
});

test('rejects mismatched public key', async () => {
  const f = await fixture();
  assert.equal(run(f.dir).status, 0);
  const { publicKey } = generateKeyPairSync('ed25519');
  await writeFile(path.join(f.dir, 'public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  assert.notEqual(run(f.dir, 'verify').status, 0);
});

test('refuses to overwrite retained seal', async () => {
  const f = await fixture();
  assert.equal(run(f.dir).status, 0);
  assert.notEqual(run(f.dir).status, 0);
  assert.ok((await readFile(path.join(f.dir, 'seal.json'))).length > 0);
});
