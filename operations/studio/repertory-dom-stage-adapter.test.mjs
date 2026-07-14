import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomStageAdapter } from './repertory-dom-stage-adapter.mjs';

class Element {
  constructor(tag, documentRef) { this.tagName = tag.toUpperCase(); this.documentRef = documentRef; this.attributes = new Map(); this.children = []; this.autoplay = false; this.paused = false; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  get firstElementChild() { return this.children[0] ?? null; }
  contains(target) { return this === target || this.children.some((child) => child.contains?.(target)); }
  focus() { this.documentRef.activeElement = this; }
  pause() { this.paused = true; }
  querySelector(selector) {
    if (selector.includes(',')) return selector.split(',').map((part) => this.querySelector(part.trim())).find(Boolean) ?? null;
    const attrMatch = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    const idMatch = selector.match(/^#(.+)$/);
    const matches = attrMatch ? this.getAttribute(attrMatch[1]) === attrMatch[2] : idMatch ? this.getAttribute('id') === idMatch[1] : false;
    if (matches) return this;
    return this.children.map((child) => child.querySelector?.(selector)).find(Boolean) ?? null;
  }
  querySelectorAll(selector) {
    const tags = new Set(selector.split(',').map((tag) => tag.trim().toUpperCase()));
    const found = tags.has(this.tagName) ? [this] : [];
    for (const child of this.children) found.push(...(child.querySelectorAll?.(selector) || []));
    return found;
  }
}

function makeDocument() {
  const documentRef = { activeElement: null, createElement(tag) { return new Element(tag, documentRef); } };
  documentRef.body = documentRef.createElement('body');
  documentRef.activeElement = documentRef.body;
  return documentRef;
}

function projection(overrides = {}) {
  return {
    production: { id: 'coordinate-bloom', title: 'Coordinate Bloom', renderer: 'coordinateBloom', audio_policy: 'silent', motion_policy: 'reducible' },
    mount_key: 'coordinate-bloom@hour-12',
    continuity: { id: 'continuity-public', revision: 'r1' },
    policy: { autoplay: false, reduced_motion: false, motion_enabled: true, audio_enabled: false, audio_activation: 'silent' },
    ...overrides,
  };
}

test('mounts a public projection and returns receipt-compatible identity', async () => {
  const doc = makeDocument(); const root = doc.createElement('main');
  const stage = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom: ({ mount }) => mount.append(doc.createElement('div')) } });
  const result = await stage(projection());
  assert.equal(result.staged, true); assert.equal(result.reversible, true);
  assert.equal(result.continuity_id, 'continuity-public'); assert.equal(root.firstElementChild.getAttribute('data-production-id'), 'coordinate-bloom');
});

test('enforces reduced-motion presentation strategy', async () => {
  const doc = makeDocument(); const root = doc.createElement('main');
  const stage = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom() {} } });
  const result = await stage(projection({ policy: { ...projection().policy, reduced_motion: true, motion_enabled: false } }));
  assert.equal(root.firstElementChild.getAttribute('data-motion'), 'reduced');
  assert.equal(result.content_strategy, 'reduced_motion_public_projection');
});

test('rejects projections that permit autoplay or initial audio', async () => {
  const doc = makeDocument(); const root = doc.createElement('main');
  const stage = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom() {} } });
  await assert.rejects(() => stage(projection({ policy: { ...projection().policy, autoplay: true } })), /prohibit autoplay/);
  await assert.rejects(() => stage(projection({ policy: { ...projection().policy, audio_enabled: true } })), /prohibit autoplay/);
});

test('neutralizes media autoplay defensively', async () => {
  const doc = makeDocument(); const root = doc.createElement('main');
  const stage = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom: ({ mount }) => { const media = doc.createElement('audio'); media.autoplay = true; media.setAttribute('autoplay', ''); mount.append(media); } } });
  await stage(projection());
  const media = root.firstElementChild.querySelectorAll('audio,video')[0];
  assert.equal(media.autoplay, false); assert.equal(media.getAttribute('autoplay'), null); assert.equal(media.paused, true);
});

test('preserves keyed focus when the renderer recreates the target', async () => {
  const doc = makeDocument(); const root = doc.createElement('main'); const oldMount = doc.createElement('section'); const oldButton = doc.createElement('button');
  oldButton.setAttribute('data-focus-key', 'audio-toggle'); oldMount.append(oldButton); root.append(oldMount); oldButton.focus();
  const stage = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom: ({ mount }) => { const replacement = doc.createElement('button'); replacement.setAttribute('data-focus-key', 'audio-toggle'); mount.append(replacement); } } });
  const result = await stage(projection());
  assert.equal(result.focus_preserved, true); assert.equal(doc.activeElement.getAttribute('data-focus-key'), 'audio-toggle');
});

test('fails closed for missing renderers and renderer autoplay claims', async () => {
  const doc = makeDocument(); const root = doc.createElement('main');
  const missing = createDomStageAdapter({ root, document_ref: doc, renderers: {} });
  await assert.rejects(() => missing(projection()), /Missing renderer/);
  const unsafe = createDomStageAdapter({ root, document_ref: doc, renderers: { coordinateBloom: () => ({ autoplay: true }) } });
  await assert.rejects(() => unsafe(projection()), /attempted to enable autoplay/);
});
