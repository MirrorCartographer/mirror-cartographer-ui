import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reproduce } from './fia-source-reproducibility.mjs';

async function fixture(script) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-repro-test-'));
  const source = path.join(root, 'source'); await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'build.mjs'), script);
  return { root, source, output: path.join(root, 'result') };
}
const stable = `import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/index.html','<!doctype html><html lang="en"><title>x</title></html>');`;

test('two clean builds produce one deterministic authority', async () => {
  const a = await fixture(stable), b = await fixture(stable);
  const ea = await reproduce({ source: a.source, output: a.output, command: [process.execPath, 'build.mjs'], sourceIdentity: 'git:test' });
  const eb = await reproduce({ source: b.source, output: b.output, command: [process.execPath, 'build.mjs'], sourceIdentity: 'git:test' });
  assert.equal(ea.contentIdentity, eb.contentIdentity);
  assert.equal(ea.runs[0].artifactIdentity, ea.runs[1].artifactIdentity);
  await fs.access(path.join(a.output, 'artifact', 'index.html'));
});

test('ambient host variables are excluded', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/env.txt', process.env.FIA_SECRET_LEAK || 'absent');`);
  process.env.FIA_SECRET_LEAK = 'should-not-appear';
  await reproduce({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] });
  assert.equal(await fs.readFile(path.join(f.output, 'artifact', 'env.txt'), 'utf8'), 'absent');
  delete process.env.FIA_SECRET_LEAK;
});

test('nondeterministic output fails closed', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/random.txt', String(Math.random()));`);
  await assert.rejects(reproduce({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] }), /nondeterministic output/);
  await assert.rejects(fs.access(f.output));
});

test('provider-coupled output is rejected', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/app.js', 'fetch("https://x.pages.dev/api")');`);
  await assert.rejects(reproduce({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] }), /provider coupling/);
});

test('false success, source symlinks, and existing outputs are rejected', async () => {
  const f = await fixture(`process.exit(0);`);
  await assert.rejects(reproduce({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] }));
  const g = await fixture(stable); await fs.symlink(path.join(g.source, 'build.mjs'), path.join(g.source, 'alias.mjs'));
  await assert.rejects(reproduce({ source: g.source, output: g.output, command: [process.execPath, 'build.mjs'] }), /symlink/);
  const h = await fixture(stable); await fs.mkdir(h.output); await fs.writeFile(path.join(h.output, 'sentinel'), 'keep');
  await assert.rejects(reproduce({ source: h.source, output: h.output, command: [process.execPath, 'build.mjs'] }), /output exists/);
  assert.equal(await fs.readFile(path.join(h.output, 'sentinel'), 'utf8'), 'keep');
});
