import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangedPathsManifest, parseArgs } from './changed-paths-from-git.mjs';

const BASE = '1111111111111111111111111111111111111111';
const HEAD = '2222222222222222222222222222222222222222';

test('builds a deterministic manifest from immutable commits', () => {
  const calls = [];
  const manifest = buildChangedPathsManifest({
    base: BASE,
    head: HEAD,
    runGit(command, args) {
      calls.push([command, args]);
      return 'src/z.js\0operations/note.json\0src/a.js\0src/a.js\0';
    }
  });

  assert.deepEqual(calls, [['git', ['diff', '--name-only', '-z', '--diff-filter=ACMRTUXB', `${BASE}..${HEAD}`]]]);
  assert.deepEqual(manifest, {
    schema_version: 1,
    comparison: { base: BASE, head: HEAD, range: `${BASE}..${HEAD}` },
    changed_paths: ['operations/note.json', 'src/a.js', 'src/z.js'],
    path_count: 3,
    path_encoding: 'nul-delimited'
  });
});

test('preserves safe spaces while rejecting filename control characters', () => {
  const manifest = buildChangedPathsManifest({
    base: BASE,
    head: HEAD,
    runGit: () => 'docs/a safe file.md\0'
  });
  assert.deepEqual(manifest.changed_paths, ['docs/a safe file.md']);

  for (const unsafe of ['docs/line\nbreak.md\0', 'docs/tab\tname.md\0', 'docs/carriage\rreturn.md\0']) {
    assert.throws(() => buildChangedPathsManifest({ base: BASE, head: HEAD, runGit: () => unsafe }), /unsafe/);
  }
});

test('rejects symbolic, short, uppercase, or equal refs', () => {
  for (const [base, head] of [
    ['main', HEAD],
    ['abc123', HEAD],
    [BASE.toUpperCase().replaceAll('1', 'A'), HEAD],
    [BASE, BASE]
  ]) {
    assert.throws(() => buildChangedPathsManifest({ base, head, runGit: () => '' }));
  }
});

test('fails closed when comparison has no changed paths', () => {
  assert.throws(
    () => buildChangedPathsManifest({ base: BASE, head: HEAD, runGit: () => '' }),
    /no changed paths/
  );
});

test('rejects unsafe paths from git output', () => {
  for (const unsafe of ['/absolute.js\0', '../escape.js\0', 'folder\\file.js\0']) {
    assert.throws(() => buildChangedPathsManifest({ base: BASE, head: HEAD, runGit: () => unsafe }), /unsafe/);
  }
});

test('propagates git comparison failures', () => {
  assert.throws(() => buildChangedPathsManifest({
    base: BASE,
    head: HEAD,
    runGit() { throw new Error('unknown revision'); }
  }), /unknown revision/);
});

test('parses the exact supported CLI contract', () => {
  assert.deepEqual(
    [...parseArgs(['--base', BASE, '--head', HEAD, '--output', 'operations/result.json'])],
    [['--base', BASE], ['--head', HEAD], ['--output', 'operations/result.json']]
  );
});

test('rejects malformed, unknown, duplicate, or incomplete CLI arguments', () => {
  for (const argv of [
    [],
    ['--base', BASE, '--head'],
    ['--base', BASE],
    ['--base', BASE, '--head', HEAD, '--unknown', 'value'],
    ['--base', BASE, '--head', HEAD, '--base', BASE],
    ['--base', '--head', HEAD],
    ['--base', BASE, '--head', '--output']
  ]) {
    assert.throws(() => parseArgs(argv));
  }
});