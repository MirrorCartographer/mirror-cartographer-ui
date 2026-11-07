import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileRuntimeRouteManifest } from './compile-runtime-route-manifest.mjs';

const HTML = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>ok</body></html>';

async function fixture(configMutator, fileMutator) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-routes-'));
  const root = path.join(dir, 'dist');
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), HTML);
  await writeFile(path.join(root, 'offline.html'), HTML);
  await writeFile(path.join(root, 'assets', 'app.js'), 'console.log("ok")\n');
  const config = {
    schema: 'fia.runtime-route-config.v1',
    routes: [{ route: '/', document: 'index.html', assets: ['assets/app.js'] }],
    offlineFallback: 'offline.html',
  };
  configMutator?.(config);
  await fileMutator?.(root);
  const configPath = path.join(dir, 'config.json');
  const outputPath = path.join(dir, 'manifest.json');
  await writeFile(configPath, JSON.stringify(config));
  return { dir, rootDir: root, configPath, outputPath };
}

test('equivalent independent trees produce identical identities', async () => {
  const a = await fixture();
  const b = await fixture();
  const ra = await compileRuntimeRouteManifest(a);
  const rb = await compileRuntimeRouteManifest(b);
  assert.equal(ra.identity, rb.identity);
  assert.deepEqual(JSON.parse(await readFile(a.outputPath, 'utf8')), JSON.parse(await readFile(b.outputPath, 'utf8')));
});

test('rejects unreferenced files', async () => {
  const f = await fixture(null, (root) => writeFile(path.join(root, 'secret.txt'), 'not declared'));
  await assert.rejects(() => compileRuntimeRouteManifest(f), /unreferenced runtime files: secret.txt/);
});

test('rejects symlinks', async () => {
  const f = await fixture(null, (root) => symlink('/etc/hosts', path.join(root, 'escape.txt')));
  await assert.rejects(() => compileRuntimeRouteManifest(f), /symlink rejected/);
});

test('rejects duplicate normalized routes', async () => {
  const f = await fixture((config) => config.routes.push({ route: '//', document: 'index.html', assets: ['assets/app.js'] }));
  await assert.rejects(() => compileRuntimeRouteManifest(f), /duplicate route/);
});

test('rejects accessibility and autoplay violations', async () => {
  const f = await fixture(null, (root) => writeFile(path.join(root, 'index.html'), '<html><body><video autoplay></video></body></html>'));
  await assert.rejects(() => compileRuntimeRouteManifest(f), /missing html lang|contains autoplay/);
});

test('rejects hosted-provider runtime coupling', async () => {
  const f = await fixture(null, (root) => writeFile(path.join(root, 'index.html'), HTML.replace('ok', 'https://example.github.io/app')));
  await assert.rejects(() => compileRuntimeRouteManifest(f), /provider coupling: github\.io/);
});

test('refuses to overwrite retained evidence', async () => {
  const f = await fixture();
  await writeFile(f.outputPath, 'retained');
  await assert.rejects(() => compileRuntimeRouteManifest(f), /EEXIST/);
  assert.equal(await readFile(f.outputPath, 'utf8'), 'retained');
});
