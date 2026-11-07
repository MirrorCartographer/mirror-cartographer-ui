import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyReproducibility } from './reproducibility-gate.mjs';

async function fixture(script) {
  const root = await mkdtemp(join(tmpdir(), 'fia-repro-fixture-'));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'build.mjs'), script);
  return root;
}

const node = process.execPath;

test('passes deterministic build', async () => {
  const root = await fixture(`import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('dist/index.html','stable\\n');`);
  const report = await verifyReproducibility({ command:[node,'build.mjs'], sourceDir:root, outputDir:'dist' });
  assert.equal(report.status, 'pass');
  assert.equal(report.runs[0].graphDigest, report.runs[1].graphDigest);
});

test('rejects timestamp nondeterminism', async () => {
  const root = await fixture(`import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('dist/time.txt',String(Date.now()));`);
  const report = await verifyReproducibility({ command:[node,'build.mjs'], sourceDir:root, outputDir:'dist' });
  assert.equal(report.status, 'fail');
  assert.equal(report.mismatches[0].path, 'time.txt');
});

test('rejects run-index nondeterminism', async () => {
  const root = await fixture(`import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('dist/run.txt',process.env.FIA_REPRO_RUN);`);
  const report = await verifyReproducibility({ command:[node,'build.mjs'], sourceDir:root, outputDir:'dist' });
  assert.equal(report.status, 'fail');
});

test('cleans stale output before each build', async () => {
  const root = await fixture(`import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('dist/current.txt','ok');`);
  await writeFile(join(root,'dist','stale.txt'),'stale');
  const report = await verifyReproducibility({ command:[node,'build.mjs'], sourceDir:root, outputDir:'dist' });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.runs[0].files.map(x=>x.path), ['current.txt']);
});

test('rejects symlink output', async (t) => {
  if (process.platform === 'win32') t.skip('symlink privileges vary on Windows');
  const root = await fixture(`import {mkdir,symlink,writeFile} from 'node:fs/promises'; await mkdir('dist',{recursive:true}); await writeFile('target.txt','x'); await symlink('../target.txt','dist/link.txt');`);
  await assert.rejects(() => verifyReproducibility({ command:[node,'build.mjs'], sourceDir:root, outputDir:'dist' }), /symlink rejected/);
});
