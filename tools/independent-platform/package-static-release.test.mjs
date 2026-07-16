import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { packageStaticRelease } from './package-static-release.mjs';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mc-release-'));
  const input = path.join(root, 'dist');
  const outputRoot = path.join(root, 'releases');
  await mkdir(path.join(input, 'assets'), { recursive: true });
  await writeFile(path.join(input, 'index.html'), '<!doctype html><title>Mirror Cartographer</title>\n');
  await writeFile(path.join(input, 'assets', 'app.js'), 'console.log("owned build")\n');
  return { root, input, outputRoot };
}

test('packages a deterministic manifest under the exact commit identity', async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const result = await packageStaticRelease({
    input: fx.input,
    outputRoot: fx.outputRoot,
    commit: COMMIT,
    createdAt: '2026-07-16T15:00:00.000Z',
  });
  assert.equal(result.manifest.commit, COMMIT);
  assert.equal(result.manifest.file_count, 2);
  assert.deepEqual(result.manifest.files.map((entry) => entry.path), ['assets/app.js', 'index.html']);
  const retained = JSON.parse(await readFile(path.join(result.releaseDir, 'release-manifest.json'), 'utf8'));
  assert.deepEqual(retained, result.manifest);
});

test('rejects branch labels and abbreviated commits', async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  await assert.rejects(
    packageStaticRelease({ input: fx.input, outputRoot: fx.outputRoot, commit: 'main', createdAt: new Date().toISOString() }),
    /40-character lowercase hexadecimal SHA/,
  );
});

test('rejects empty build output', async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  await rm(fx.input, { recursive: true, force: true });
  await mkdir(fx.input, { recursive: true });
  await assert.rejects(
    packageStaticRelease({ input: fx.input, outputRoot: fx.outputRoot, commit: COMMIT, createdAt: new Date().toISOString() }),
    /empty build/,
  );
});

test('fails closed rather than overwriting an existing immutable release', async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const args = { input: fx.input, outputRoot: fx.outputRoot, commit: COMMIT, createdAt: '2026-07-16T15:00:00.000Z' };
  await packageStaticRelease(args);
  await assert.rejects(packageStaticRelease(args), /immutable release already exists/);
});

test('rejects invalid verification time', async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  await assert.rejects(
    packageStaticRelease({ input: fx.input, outputRoot: fx.outputRoot, commit: COMMIT, createdAt: 'recently' }),
    /parseable timestamp/,
  );
});
