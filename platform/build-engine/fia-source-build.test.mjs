import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSource } from './fia-source-build.mjs';

const validHtml = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>MC</title></head><body></body></html>';

async function fixture(scriptBody) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-source-test-'));
  const source = path.join(root, 'source');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'build.mjs'), scriptBody);
  return { root, source, output: path.join(root, 'result') };
}

test('two clean builds produce one deterministic release authority', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/index.html', ${JSON.stringify(validHtml)}); console.log('built');`);
  const evidence = await compileSource({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'], sourceIdentity: 'git:test' });
  assert.match(evidence.contentIdentity, /^sha256:/);
  assert.equal(evidence.runs.length, 2);
  assert.equal(await fs.readFile(path.join(f.output, 'build-1.stdout.log'), 'utf8'), 'built\n');
  assert.equal(JSON.parse(await fs.readFile(path.join(f.output, 'release', 'manifest.json'), 'utf8')).releaseIdentity, evidence.releaseIdentity);
});

test('ambient host variables are not inherited', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/index.html', ${JSON.stringify(validHtml)} + '<!--' + (process.env.FIA_SECRET_LEAK ?? 'absent') + '-->');`);
  process.env.FIA_SECRET_LEAK = 'should-not-appear';
  try {
    await compileSource({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] });
    const manifest = JSON.parse(await fs.readFile(path.join(f.output, 'release', 'manifest.json'), 'utf8'));
    const object = await fs.readFile(path.join(f.output, 'release', 'objects', 'sha256', manifest.files[0].sha256.slice(7)), 'utf8');
    assert.match(object, /absent/);
    assert.doesNotMatch(object, /should-not-appear/);
  } finally {
    delete process.env.FIA_SECRET_LEAK;
  }
});

test('nondeterministic output is rejected', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/index.html', ${JSON.stringify(validHtml)} + Math.random());`);
  await assert.rejects(compileSource({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] }), /reproducibility mismatch/);
  await assert.rejects(fs.access(f.output));
});

test('provider-coupled output is rejected', async () => {
  const f = await fixture(`import { promises as fs } from 'node:fs'; await fs.mkdir('dist'); await fs.writeFile('dist/index.html', ${JSON.stringify(validHtml)} + '<script src="https://x.pages.dev/app.js"></script>');`);
  await assert.rejects(compileSource({ source: f.source, output: f.output, command: [process.execPath, 'build.mjs'] }), /provider coupling/);
});

test('false success, source symlink, timeout, and existing output fail closed', async () => {
  const missing = await fixture(`process.exit(0);`);
  await assert.rejects(compileSource({ source: missing.source, output: missing.output, command: [process.execPath, 'build.mjs'] }), /did not produce/);

  const linked = await fixture(``);
  await fs.symlink(path.join(linked.source, 'build.mjs'), path.join(linked.source, 'alias.mjs'));
  await assert.rejects(compileSource({ source: linked.source, output: linked.output, command: [process.execPath, 'build.mjs'] }), /symlink rejected/);

  const timed = await fixture(`await new Promise(resolve => setTimeout(resolve, 1000));`);
  await assert.rejects(compileSource({ source: timed.source, output: timed.output, command: [process.execPath, 'build.mjs'], timeoutMs: 50 }), /timed out/);

  const existing = await fixture(``);
  await fs.mkdir(existing.output);
  await fs.writeFile(path.join(existing.output, 'sentinel'), 'keep');
  await assert.rejects(compileSource({ source: existing.source, output: existing.output, command: [process.execPath, 'build.mjs'] }), /output exists/);
  assert.equal(await fs.readFile(path.join(existing.output, 'sentinel'), 'utf8'), 'keep');
});
