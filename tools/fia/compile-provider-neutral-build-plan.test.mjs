import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compilePlan } from './compile-provider-neutral-build-plan.mjs';

async function fixture({ scripts = { 'build:owned': 'vite build' }, config = {} } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-plan-'));
  const packagePath = path.join(dir, 'package.json');
  const configPath = path.join(dir, 'config.json');
  await writeFile(packagePath, JSON.stringify({ name: 'fixture', version: '1.0.0', scripts }, null, 2));
  await writeFile(configPath, JSON.stringify({ schema: 'fia.provider-neutral-build-config.v1', buildScript: 'build:owned', ...config }, null, 2));
  return { packagePath, configPath };
}

test('equivalent inputs compile to the same identity', async () => {
  const a = await fixture();
  const b = await fixture();
  assert.equal((await compilePlan(a)).identity, (await compilePlan(b)).identity);
});

test('finds direct provider coupling', async () => {
  const files = await fixture({ scripts: { 'build:owned': 'vercel build' } });
  await assert.rejects(() => compilePlan(files), /provider coupling.*vercel/i);
});

test('finds transitive provider coupling hidden in another script', async () => {
  const files = await fixture({ scripts: { 'build:owned': 'npm run compile && npm run publish', compile: 'vite build', publish: 'wrangler pages deploy dist' } });
  await assert.rejects(() => compilePlan(files), /provider coupling.*wrangler/i);
});

test('rejects script cycles', async () => {
  const files = await fixture({ scripts: { 'build:owned': 'npm run again', again: 'npm run build:owned' } });
  await assert.rejects(() => compilePlan(files), /script cycle/i);
});

test('rejects provider-specific environment authority', async () => {
  const files = await fixture({ config: { envAllowlist: ['CI', 'VERCEL_URL'] } });
  await assert.rejects(() => compilePlan(files), /provider-specific environment/i);
});

test('rejects output/input overlap', async () => {
  const files = await fixture({ config: { inputs: ['dist/source'], output: 'dist' } });
  await assert.rejects(() => compilePlan(files), /output must not contain admitted inputs/i);
});
