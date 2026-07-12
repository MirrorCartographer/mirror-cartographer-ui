import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDeploymentIrrelevantPath,
  requiresVercelBuild,
} from './vercel-ignore-build.mjs';

test('ignores operations-only evidence commits', () => {
  assert.equal(
    requiresVercelBuild([
      'operations/evidence/V-001-example.json',
      'operations/queue-updates/V-001-example.json',
    ]),
    false,
  );
});

test('builds application and public asset changes', () => {
  assert.equal(requiresVercelBuild(['src/App.jsx']), true);
  assert.equal(requiresVercelBuild(['public/audio/chime.mp3']), true);
});

test('builds known deployment configuration changes', () => {
  assert.equal(requiresVercelBuild(['package-lock.json']), true);
  assert.equal(requiresVercelBuild(['vercel.json']), true);
});

test('builds unknown root and nested configuration changes', () => {
  assert.equal(requiresVercelBuild(['tailwind.config.js']), true);
  assert.equal(requiresVercelBuild(['config/runtime-flags.json']), true);
});

test('builds mixed operations and application commits', () => {
  assert.equal(
    requiresVercelBuild([
      'operations/evidence/V-001-example.json',
      'src/App.jsx',
    ]),
    true,
  );
});

test('builds when the changed-path set is unexpectedly empty', () => {
  assert.equal(requiresVercelBuild([]), true);
});

test('recognizes only explicit operations paths as deployment irrelevant', () => {
  assert.equal(isDeploymentIrrelevantPath('operations/CURRENT_STATE.json'), true);
  assert.equal(isDeploymentIrrelevantPath('operation-notes/example.md'), false);
});

test('builds changes to the deployment filter itself', () => {
  assert.equal(requiresVercelBuild(['scripts/vercel-ignore-build.mjs']), true);
});
