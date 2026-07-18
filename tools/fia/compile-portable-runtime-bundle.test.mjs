import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compilePortableRuntimeBundle } from './compile-portable-runtime-bundle.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-bundle-test-'));
  for (const target of ['current', 'rollback']) {
    await fs.mkdir(path.join(root, target, 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, target, 'index.html'), `<!doctype html><html><body>${target}</body></html>`);
    await fs.writeFile(path.join(root, target, 'assets', 'shared.js'), 'console.log("shared")\n');
  }
  return root;
}

async function run(root, suffix = 'a') {
  return compilePortableRuntimeBundle({
    current: path.join(root, 'current'),
    rollback: path.join(root, 'rollback'),
    bundle: path.join(root, `bundle-${suffix}`),
    rehearsal: path.join(root, `rehearsal-${suffix}.json`),
  });
}

test('equivalent builds are deterministic', async () => {
  const first = await fixture();
  const second = await fixture();
  try {
    const a = await run(first);
    const b = await run(second);
    assert.equal(a.manifest.identity, b.manifest.identity);
    assert.equal(a.rehearsal.identity, b.rehearsal.identity);
  } finally {
    await fs.rm(first, { recursive: true, force: true });
    await fs.rm(second, { recursive: true, force: true });
  }
});

test('shared bytes deduplicate', async () => {
  const root = await fixture();
  try {
    const result = await run(root);
    assert.ok(result.manifest.objects.count < 4);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('current and rollback boot in rehearsal', async () => {
  const root = await fixture();
  try {
    const result = await run(root);
    assert.deepEqual(result.rehearsal.probes.map((probe) => probe.target), ['current', 'rollback']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('symlink contamination is rejected', async (context) => {
  if (process.platform === 'win32') return context.skip();
  const root = await fixture();
  try {
    await fs.symlink('index.html', path.join(root, 'current', 'link.html'));
    await assert.rejects(run(root), /symlink rejected/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('existing destination fails closed', async () => {
  const root = await fixture();
  try {
    await fs.mkdir(path.join(root, 'bundle-a'));
    await assert.rejects(run(root), /destination exists/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('object tampering diverges from retained identity', async () => {
  const root = await fixture();
  try {
    const result = await run(root);
    const file = result.manifest.artifacts.current.files[0];
    const objectPath = path.join(root, 'bundle-a', file.object);
    await fs.writeFile(objectPath, 'tampered');
    const actual = `sha256:${createHash('sha256').update(await fs.readFile(objectPath)).digest('hex')}`;
    assert.notEqual(actual, file.sha256);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
