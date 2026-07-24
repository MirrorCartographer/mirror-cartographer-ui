import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from './fia-build.mjs';

const validHtml = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Mirror Cartographer</title></head><body><img alt="" src="asset.png"></body></html>';

async function fixture(html = validHtml) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-build-'));
  const input = path.join(root, 'dist');
  await fs.mkdir(input);
  await fs.writeFile(path.join(input, 'index.html'), html);
  await fs.writeFile(path.join(input, 'asset.png'), Buffer.from([1, 2, 3]));
  return { root, input, output: path.join(root, 'release') };
}

test('equivalent clean inputs produce identical release authority', async () => {
  const first = await fixture();
  const second = await fixture();
  const firstManifest = await build({ input: first.input, output: first.output, sourceIdentity: 'git:test' });
  const secondManifest = await build({ input: second.input, output: second.output, sourceIdentity: 'git:test' });
  assert.equal(firstManifest.releaseIdentity, secondManifest.releaseIdentity);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(first.output, 'manifest.json'), 'utf8')),
    JSON.parse(await fs.readFile(path.join(second.output, 'manifest.json'), 'utf8')),
  );
});

test('source-byte mutation changes release identity', async () => {
  const first = await fixture();
  const second = await fixture();
  await fs.appendFile(path.join(second.input, 'index.html'), '<!-- changed -->');
  const firstManifest = await build({ input: first.input, output: first.output, sourceIdentity: 'git:test' });
  const secondManifest = await build({ input: second.input, output: second.output, sourceIdentity: 'git:test' });
  assert.notEqual(firstManifest.releaseIdentity, secondManifest.releaseIdentity);
});

test('accessibility and autoplay gates fail closed', async () => {
  const invalid = [
    '<html><head><title>x</title></head><body></body></html>',
    '<!doctype html><html lang="en"><head><meta name="viewport" content="x"><title>x</title></head><body><video autoplay></video></body></html>',
    '<!doctype html><html lang="en"><head><meta name="viewport" content="x"><title>x</title></head><body><img src="x.png"></body></html>',
  ];
  for (const html of invalid) {
    const current = await fixture(html);
    await assert.rejects(build({ input: current.input, output: current.output }));
    await assert.rejects(fs.access(current.output));
  }
});

test('symlinks and existing output authority are rejected', async () => {
  const symlinkFixture = await fixture();
  await fs.symlink(path.join(symlinkFixture.input, 'index.html'), path.join(symlinkFixture.input, 'alias.html'));
  await assert.rejects(build({ input: symlinkFixture.input, output: symlinkFixture.output }), /symlink rejected/);

  const existingFixture = await fixture();
  await fs.mkdir(existingFixture.output);
  await fs.writeFile(path.join(existingFixture.output, 'sentinel'), 'keep');
  await assert.rejects(build({ input: existingFixture.input, output: existingFixture.output }), /output exists/);
  assert.equal(await fs.readFile(path.join(existingFixture.output, 'sentinel'), 'utf8'), 'keep');
});

test('root route is mandatory and nested index routes are canonical', async () => {
  const missingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-build-'));
  const missingInput = path.join(missingRoot, 'dist');
  await fs.mkdir(missingInput);
  await fs.writeFile(path.join(missingInput, 'about.html'), validHtml);
  await assert.rejects(build({ input: missingInput, output: path.join(missingRoot, 'out') }), /missing root route/);

  const nested = await fixture();
  await fs.mkdir(path.join(nested.input, 'about'));
  await fs.writeFile(path.join(nested.input, 'about', 'index.html'), validHtml);
  const manifest = await build({ input: nested.input, output: nested.output });
  assert.deepEqual(manifest.routes.map(({ route }) => route), ['/', '/about']);
});
