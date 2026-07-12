import assert from 'node:assert/strict';
import test from 'node:test';

import { requiresVercelBuild } from './vercel-ignore-build.mjs';

test('ignores operations-only evidence commits', () => {
  assert.equal(
    requiresVercelBuild([
      'operations/evidence/V-001-example.json',
      'operations/queue-updates/V-001-example.json',
    ]),
    false,
  );
});

test('builds application source changes', () => {
  assert.equal(requiresVercelBuild(['src/App.jsx']), true);
});

test('builds public asset changes', () => {
  assert.equal(requiresVercelBuild(['public/audio/chime.mp3']), true);
});

test('builds dependency and Vercel configuration changes', () => {
  assert.equal(requiresVercelBuild(['package-lock.json']), true);
  assert.equal(requiresVercelBuild(['vercel.json']), true);
});

test('builds changes to the deployment filter itself', () => {
  assert.equal(requiresVercelBuild(['scripts/vercel-ignore-build.mjs']), true);
});
