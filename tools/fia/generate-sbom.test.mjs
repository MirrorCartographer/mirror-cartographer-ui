import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateSbom, main } from './generate-sbom.mjs';

function fixture() {
  return {
    name: 'mc',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'mc', version: '1.0.0', dependencies: { react: '18.3.1' } },
      'node_modules/react': {
        version: '18.3.1',
        resolved: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz',
        integrity: 'sha512-QUJDREVGRw=='
      }
    }
  };
}

test('emits stable CycloneDX identity regardless of object insertion order', () => {
  const a = fixture();
  const b = {
    lockfileVersion: 3,
    packages: {
      'node_modules/react': a.packages['node_modules/react'],
      '': a.packages['']
    },
    version: '1.0.0',
    name: 'mc'
  };
  assert.equal(generateSbom(a).identity, generateSbom(b).identity);
  assert.deepEqual(generateSbom(a).sbom.dependencies[0].dependsOn, [
    'pkg:npm/react@18.3.1?fia_path=node_modules%2Freact'
  ]);
});

test('rejects missing integrity to prevent unverifiable components', () => {
  const value = fixture();
  delete value.packages['node_modules/react'].integrity;
  assert.throws(() => generateSbom(value), /Missing integrity/);
});

test('rejects SHA-1 and malformed integrity tokens', () => {
  const value = fixture();
  value.packages['node_modules/react'].integrity = 'sha1-deadbeef';
  assert.throws(() => generateSbom(value), /Unsupported integrity token/);
});

test('disambiguates identical package versions at different lockfile paths', () => {
  const value = fixture();
  value.packages['node_modules/x/node_modules/react'] = {
    ...value.packages['node_modules/react']
  };
  const refs = generateSbom(value).sbom.components.map((component) => component['bom-ref']);
  assert.equal(new Set(refs).size, 2);
});

test('rejects unsupported lockfile versions and missing package graphs', () => {
  assert.throws(() => generateSbom({ lockfileVersion: 1, packages: {} }), /Unsupported/);
  assert.throws(() => generateSbom({ lockfileVersion: 3 }), /packages graph/);
});

test('CLI refuses to overwrite retained evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fia-sbom-'));
  const lock = join(dir, 'package-lock.json');
  const out = join(dir, 'sbom.json');
  writeFileSync(lock, JSON.stringify(fixture()));
  main(['--lockfile', lock, '--output', out]);
  assert.equal(JSON.parse(readFileSync(out, 'utf8')).bomFormat, 'CycloneDX');
  assert.throws(() => main(['--lockfile', lock, '--output', out]), /EEXIST/);
});
