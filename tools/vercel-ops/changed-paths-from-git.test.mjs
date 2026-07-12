import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChangedPathsManifest } from './changed-paths-from-git.mjs';

const BASE = '1111111111111111111111111111111111111111';
const HEAD = '2222222222222222222222222222222222222222';

test('builds a deterministic manifest from immutable commits', () => {
  const calls = [];
  const manifest = buildChangedPathsManifest({
    base: BASE,
    head: HEAD,
    runGit(command, args) {
      calls.push([command, args]);
      return 'src/z.js\noperations/note.json\nsrc/a.js\nsrc/a.js\n';
    }
  });

  assert.deepEqual(calls, [['git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${BASE}..${HEAD}`]]]);
  assert.deepEqual(manifest, {
    schema_version: 1,
    comparison: { base: BASE, head: HEAD, range: `${BASE}..${HEAD}` },
    changed_paths: ['operations/note.json', 'src/a.js', 'src/z.js'],
    path_count: 3
  });
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
    () => buildChangedPathsManifest({ base: BASE, head: HEAD, runGit: () => '\n' }),
    /no changed paths/
  );
});

test('rejects unsafe paths from git output', () => {
  for (const unsafe of ['/absolute.js\n', '../escape.js\n', 'folder\\file.js\n']) {
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
