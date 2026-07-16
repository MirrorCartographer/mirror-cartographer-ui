import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = resolve('tools/fia-build.mjs');
const root = await mkdtemp(join(tmpdir(), 'fia-build-'));

const run = (...extra) => spawnSync(process.execPath, [tool, '--root', root, '--input', 'dist', '--out', '.fia', '--skip-compile', '--source-date-epoch', '1700000000', ...extra], { encoding: 'utf8' });

try {
  await mkdir(join(root, 'dist', 'assets'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture-app', version: '1.2.3', dependencies: { react: '18.3.1' } }));
  await writeFile(join(root, 'package-lock.json'), '{}\n');
  await writeFile(join(root, 'dist', 'index.html'), '<!doctype html><title>fixture</title>\n');
  await writeFile(join(root, 'dist', 'assets', 'app.js'), 'console.log("stable")\n');

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const firstId = first.stdout.trim();
  const firstCurrent = await readFile(join(root, '.fia', 'current.json'), 'utf8');
  const firstHash = firstId.replace('sha256:', '');
  const firstManifest = await readFile(join(root, '.fia', 'artifacts', firstHash, 'manifest.json'), 'utf8');

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout.trim(), firstId, 'same payload must produce same artifact identity');
  assert.equal(await readFile(join(root, '.fia', 'current.json'), 'utf8'), firstCurrent, 'pointer metadata must be byte-identical');
  assert.equal(await readFile(join(root, '.fia', 'artifacts', firstHash, 'manifest.json'), 'utf8'), firstManifest, 'manifest must be byte-identical');

  await writeFile(join(root, 'dist', 'assets', 'app.js'), 'console.log("changed")\n');
  const changed = run();
  assert.equal(changed.status, 0, changed.stderr);
  assert.notEqual(changed.stdout.trim(), firstId, 'payload mutation must change artifact identity');

  await rm(join(root, 'package-lock.json'));
  const unlocked = run();
  assert.notEqual(unlocked.status, 0, 'unlocked dependency graph must fail closed');
  assert.match(unlocked.stderr, /no dependency lockfile/i);

  const explicitExperiment = run('--allow-unlocked');
  assert.equal(explicitExperiment.status, 0, explicitExperiment.stderr);
  const experimentId = explicitExperiment.stdout.trim().replace('sha256:', '');
  const experimentManifest = JSON.parse(await readFile(join(root, '.fia', 'artifacts', experimentId, 'manifest.json'), 'utf8'));
  assert.equal(experimentManifest.reproducible, false);

  console.log('fia-build deterministic artifact tests passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
