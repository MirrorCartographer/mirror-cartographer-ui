#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = new URL('./dependency-vault.mjs', import.meta.url).pathname;
const root = await mkdtemp(path.join(tmpdir(), 'foundation-dependency-vault-'));
const vault = path.join(root, 'vault');
const blob = Buffer.from('controlled fixture tarball bytes');
const digest = createHash('sha512').update(blob).digest();
const integrity = `sha512-${digest.toString('base64')}`;
const sha512 = digest.toString('hex');
const sha256 = createHash('sha256').update(blob).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const lock = {
  name: 'fixture',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': { name: 'fixture', version: '1.0.0' },
    'node_modules/example': {
      version: '1.2.3',
      resolved: 'https://registry.npmjs.org/example/-/example-1.2.3.tgz',
      integrity
    }
  }
};
const lockPath = path.join(root, 'package-lock.json');
await writeFile(lockPath, JSON.stringify(lock));
await mkdir(path.join(vault, 'blobs', 'sha512'), { recursive: true });
const blobRelative = `blobs/sha512/${sha512}.tgz`;
const blobPath = path.join(vault, blobRelative);
await writeFile(blobPath, blob);
await chmod(blobPath, 0o444);
const index = {
  schema: 'foundation.dependency-vault.index.v1',
  generatedFrom: 'package-lock.json',
  packageCount: 1,
  records: [{
    packagePath: 'node_modules/example', name: 'example', version: '1.2.3',
    upstream: lock.packages['node_modules/example'].resolved,
    integrity, blob: blobRelative, size: blob.length, sha256, sha512
  }]
};
index.canonicalSha256 = createHash('sha256').update(canonical(index)).digest('hex');
await writeFile(path.join(vault, 'index.json'), JSON.stringify(index));

function run(command, expectedStatus, expectedText) {
  const result = spawnSync(process.execPath, [tool, command, lockPath, vault], { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== expectedStatus || !output.includes(expectedText)) {
    console.error(output);
    throw new Error(`${command}: expected status ${expectedStatus} and ${expectedText}, got ${result.status}`);
  }
  console.log(`PASS ${expectedText}`);
}

run('audit', 0, 'ACCEPT 1 dependency records');
run('verify', 0, 'ACCEPT vault contains 1');

const weak = structuredClone(lock);
weak.packages['node_modules/example'].integrity = `sha1-${createHash('sha1').update(blob).digest('base64')}`;
await writeFile(lockPath, JSON.stringify(weak));
run('audit', 1, 'integrity algorithm sha1');

await writeFile(lockPath, JSON.stringify(lock));
await chmod(blobPath, 0o644);
await writeFile(blobPath, Buffer.from('corrupted bytes'));
run('verify', 1, 'vault blob SHA-512 mismatch');

const foreign = structuredClone(lock);
foreign.packages['node_modules/example'].resolved = 'https://evil.invalid/example.tgz';
await writeFile(lockPath, JSON.stringify(foreign));
run('audit', 1, 'registry host evil.invalid not allowed');

console.log('PASS all dependency custody adversarial tests');
