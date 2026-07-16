import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLockfileObject, LockfileValidationError } from './validate-lockfile.mjs';

const integrity = `sha512-${Buffer.from('fixture').toString('base64')}`;
function validLock() {
  return {
    name: 'fixture', lockfileVersion: 3, requires: true,
    packages: {
      '': { name: 'fixture', version: '1.0.0' },
      'node_modules/react': { version: '18.3.1', resolved: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz', integrity },
    },
  };
}

function codes(fn) {
  try { fn(); assert.fail('expected validation failure'); }
  catch (error) { assert.ok(error instanceof LockfileValidationError); return error.issues.map((i) => i.code); }
}

test('accepts a pinned canonical npm dependency and emits stable identities', () => {
  const a = validateLockfileObject(validLock());
  const b = validateLockfileObject(JSON.parse(JSON.stringify(validLock())));
  assert.equal(a.valid, true); assert.equal(a.packageCount, 1);
  assert.equal(a.lockfileSha256, b.lockfileSha256); assert.equal(a.policySha256, b.policySha256);
});

test('rejects missing integrity metadata', () => {
  const lock = validLock(); delete lock.packages['node_modules/react'].integrity;
  assert.ok(codes(() => validateLockfileObject(lock)).includes('MISSING_INTEGRITY'));
});

test('rejects mutable git dependency sources', () => {
  const lock = validLock(); lock.packages['node_modules/react'].resolved = 'git+https://github.com/facebook/react.git#main';
  assert.ok(codes(() => validateLockfileObject(lock)).includes('MUTABLE_SOURCE'));
});

test('rejects insecure and unapproved dependency origins', () => {
  const lock = validLock(); lock.packages['node_modules/react'].resolved = 'http://evil.example/react.tgz';
  const found = codes(() => validateLockfileObject(lock));
  assert.ok(found.includes('MUTABLE_SOURCE')); assert.ok(found.includes('INSECURE_SOURCE')); assert.ok(found.includes('UNAPPROVED_HOST'));
});

test('rejects unsupported lockfile versions and missing package graph', () => {
  const found = codes(() => validateLockfileObject({ lockfileVersion: 1 }));
  assert.ok(found.includes('UNSUPPORTED_LOCKFILE_VERSION')); assert.ok(found.includes('MISSING_PACKAGES_GRAPH'));
});

test('rejects malformed integrity tokens', () => {
  const lock = validLock(); lock.packages['node_modules/react'].integrity = 'sha1-not-allowed';
  assert.ok(codes(() => validateLockfileObject(lock)).includes('INVALID_INTEGRITY'));
});

test('policy identity changes when approved hosts change', () => {
  const a = validateLockfileObject(validLock());
  const b = validateLockfileObject(validLock(), { allowHosts: ['registry.npmjs.org', 'mirror.internal'] });
  assert.notEqual(a.policySha256, b.policySha256);
});
