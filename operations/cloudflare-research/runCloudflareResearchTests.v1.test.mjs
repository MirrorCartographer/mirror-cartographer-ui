import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePackageBindings } from './runCloudflareResearchTests.v1.mjs';

const canonical = {
  scripts: {
    'test:cloudflare-research': 'node operations/cloudflare-research/runCloudflareResearchTests.v1.mjs',
    'test:local-gate': 'npm run test:infrastructure && npm run test:cloudflare-research && npm run build',
    'test:pages-preview': 'npm run test:deployment-gate && npm run test:cloudflare-research && npm run build:pages'
  }
};

function fixture(mutator) {
  const value = structuredClone(canonical);
  mutator(value.scripts);
  return value;
}

test('accepts canonical fail-closed package bindings', () => {
  assert.equal(validatePackageBindings(canonical), true);
});

test('rejects removal from local gate', () => {
  const value = fixture((scripts) => {
    scripts['test:local-gate'] = 'npm run test:infrastructure && npm run build';
  });
  assert.throws(() => validatePackageBindings(value), /test:local-gate/);
});

test('rejects removal from pages preview gate', () => {
  const value = fixture((scripts) => {
    scripts['test:pages-preview'] = 'npm run test:deployment-gate && npm run build:pages';
  });
  assert.throws(() => validatePackageBindings(value), /test:pages-preview/);
});

test('rejects a merely echoed or embedded invocation', () => {
  const value = fixture((scripts) => {
    scripts['test:local-gate'] = 'npm run test:infrastructure && echo npm run test:cloudflare-research && npm run build';
  });
  assert.throws(() => validatePackageBindings(value), /discrete fail-closed step/);
});

test('rejects duplicate invocation that can obscure gate structure', () => {
  const value = fixture((scripts) => {
    scripts['test:pages-preview'] = 'npm run test:cloudflare-research && npm run test:deployment-gate && npm run test:cloudflare-research';
  });
  assert.throws(() => validatePackageBindings(value), /exactly once/);
});

test('rejects malformed scripts metadata without throwing a type error', () => {
  assert.throws(() => validatePackageBindings({ scripts: null }), /scripts must be an object/);
});
