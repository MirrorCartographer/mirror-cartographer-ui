import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicRepertoryRuntime } from './repertory-runtime.mjs';

class Element {
  constructor(tag, documentRef) { this.tagName = tag.toUpperCase(); this.documentRef = documentRef; this.attributes = new Map(); this.children = []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  get firstElementChild() { return this.children[0] ?? null; }
  contains(target) { return this === target || this.children.some((child) => child.contains?.(target)); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() { this.documentRef.activeElement = this; }
}

function makeDocument() {
  const documentRef = { activeElement: null, createElement(tag) { return new Element(tag, documentRef); } };
  documentRef.body = documentRef.createElement('body');
  documentRef.activeElement = documentRef.body;
  return documentRef;
}

function setup(matches = false) {
  const documentRef = makeDocument();
  const root = documentRef.createElement('main');
  const calls = [];
  const renderers = new Proxy({}, {
    get: (_target, name) => ({ mount, projection }) => {
      calls.push({ name, projection });
      mount.append(documentRef.createElement('div'));
    },
  });
  const runtime = createPublicRepertoryRuntime({
    root,
    renderers,
    continuity: { id: 'public-continuity', revision: 'r7' },
    document_ref: documentRef,
    match_media: () => ({ matches }),
    clock: () => new Date('2026-07-14T12:00:00-04:00'),
  });
  return { root, calls, runtime };
}

test('selects the deterministic hourly production and preserves continuity', async () => {
  const { runtime } = setup();
  const result = await runtime.present({ hour: 12, observed_at: new Date('2026-07-14T16:00:00Z') });
  assert.equal(result.scheduled.production_id, 'coordinate-bloom');
  assert.equal(result.receipt.continuity.id, 'public-continuity');
  assert.equal(result.runtime.self_scheduled, false);
  assert.equal(result.runtime.autoplay, false);
});

test('uses reduced-motion preference when no override is supplied', async () => {
  const { runtime } = setup(true);
  const result = await runtime.present({ hour: 13, observed_at: new Date('2026-07-14T17:00:00Z') });
  assert.equal(result.scheduled.production_id, 'paper-weather');
  assert.equal(result.projection.policy.reduced_motion, true);
  assert.equal(result.projection.policy.motion_enabled, false);
});

test('explicit reduced-motion override is deterministic and reversible', async () => {
  const { runtime } = setup(true);
  const result = await runtime.present({ hour: 15, reduced_motion: false, observed_at: new Date('2026-07-14T19:00:00Z') });
  assert.equal(result.scheduled.production_id, 'night-index');
  assert.equal(result.projection.policy.motion_enabled, true);
  assert.equal(result.receipt.rollback.reversible, true);
  assert.match(result.runtime.rollback_selector, /night-index@hour-15/);
});
