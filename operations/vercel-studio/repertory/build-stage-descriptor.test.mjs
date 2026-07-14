import assert from 'node:assert/strict';
import { buildStageDescriptor } from './build-stage-descriptor.mjs';

const productions = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  id: `hour-${String(hour).padStart(2, '0')}`,
  title: `Production ${hour}`,
  grammar: 'test grammar',
  autoplay: false,
  continuity_channel: 'shared-runtime-state',
  accessibility: ['keyboard-complete', 'screen-reader-labelled', 'reduced-motion-safe'],
}));

const schedule = {
  schema_version: 1,
  selection: {
    strategy: 'local-hour-modulo',
    timezone: 'America/New_York',
    fallback: 'hour-00',
    randomness: false,
  },
  continuity: { state_channel: 'shared-runtime-state' },
  productions,
};

const base = {
  schedule,
  continuityState: { channel: 'shared-runtime-state', revision: 'r7' },
  hour: 21,
  publicMetadata: {
    provenance_class: 'current_decision',
    nested: { tags: ['public', { status: 'observed' }] },
  },
};

const descriptor = buildStageDescriptor(base);
assert.equal(descriptor.production.id, 'hour-21');
assert.equal(descriptor.activation, 'operations-only-default-off');
assert.equal(descriptor.controls.autoplay, false);
assert.equal(descriptor.controls.payments, false);
assert.equal(descriptor.controls.conversion_logic, false);
assert(Object.isFrozen(descriptor));
assert(Object.isFrozen(descriptor.production));
assert(Object.isFrozen(descriptor.production.accessibility));
assert(Object.isFrozen(descriptor.public_metadata.nested));
assert(Object.isFrozen(descriptor.public_metadata.nested.tags));
assert(Object.isFrozen(descriptor.public_metadata.nested.tags[1]));
assert.throws(() => buildStageDescriptor({ ...base, continuityState: { channel: 'fork' } }), /must match/);
assert.throws(() => buildStageDescriptor({ ...base, publicMetadata: { private_source: 'x' } }), /forbidden/);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { provenance: { private_sources: ['x'] } } }),
  /public metadata\.provenance\.private_sources/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { layers: [{ checkout: '/pay' }] } }),
  /public metadata\.layers\[0\]\.checkout/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'contact mirrorcartographer@example.com' } }),
  /email-address at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'api_key=not-public' } }),
  /credential-assignment at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'Bearer abcdefghijklmnop' } }),
  /bearer-token at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'derived from a private chat' } }),
  /private-source-marker at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'visit /checkout now' } }),
  /commerce-route at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: 'x'.repeat(281) } }),
  /exceeds 280 characters at public metadata\.note/,
);
assert.throws(
  () => buildStageDescriptor({ ...base, publicMetadata: { note: `visible\u0000hidden` } }),
  /control characters at public metadata\.note/,
);
assert.throws(() => buildStageDescriptor({ ...base, date: new Date() }), /exactly one/);
assert.throws(() => buildStageDescriptor({ schedule, continuityState: { channel: 'shared-runtime-state' }, publicMetadata: {} }), /exactly one/);

console.log(JSON.stringify({
  tests: 24,
  passed: 24,
  production: descriptor.production.title,
  activation: descriptor.activation,
  privacy_boundary: 'recursive-keys-and-bounded-strings',
}));
