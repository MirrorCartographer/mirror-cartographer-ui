import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRepertoryProjection } from '../studio/repertory-stage-transaction.mjs';

class Element {
  constructor(tag = 'div') { this.tagName = tag; this.attrs = new Map(); this.children = []; this.parent = null; this.textContent = ''; this.inert = false; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
  removeAttribute(name) { this.attrs.delete(name); }
  append(node) { node.parent = this; this.children.push(node); }
  contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false; }
  querySelector(selector) {
    const match = selector.match(/^\[([^\]]+)\]$/);
    if (!match) return null;
    return this.children.find((child) => child.attrs.has(match[1])) ?? null;
  }
}

function fixture(withRoot = true) {
  const root = new Element('main');
  const button = new Element('button');
  root.append(button);
  const body = new Element('body');
  const document = {
    body,
    activeElement: button,
    querySelector(selector) { return withRoot && selector === '[data-mirror-repertory-root]' ? root : null; },
    createElement(tag) { return new Element(tag); },
  };
  return { document, root, button };
}

function projection(overrides = {}) {
  return {
    schema_version: 1,
    mount_key: '2026-07-14T11:00-04:00/coordinate-carnival',
    production: { id: 'coordinate-carnival', title: 'Coordinate Carnival', form: 'stage', visual_grammar: 'hand-drawn coordinates and orbital type' },
    continuity: { version: 1, channel: 'shared-state', revision: 10 },
    lifecycle: { suspended: false },
    accessibility: { landmark_role: 'region', label: 'Coordinate Carnival — stage', aria_live: 'off' },
    media: { autoplay: false, audio_start_requires_user_gesture: true },
    privacy: { private_source_material: false, raw_continuity_marks_exposed: false },
    commerce: { payment_logic: false, conversion_logic: false },
    ...overrides,
  };
}

test('stages one identity-bound production without replacing focused content', () => {
  const { document, root, button } = fixture();
  const result = stageRepertoryProjection(document, projection());
  assert.equal(result.staged, true);
  assert.equal(result.production_id, 'coordinate-carnival');
  assert.equal(result.mount_key, '2026-07-14T11:00-04:00/coordinate-carnival');
  assert.equal(result.focus_preserved, true);
  assert.equal(result.reversible, true);
  assert.equal(document.activeElement, button);
  assert.equal(root.getAttribute('data-production-id'), 'coordinate-carnival');
});

test('suspends the same continuity surface without deleting retained content', () => {
  const { document, root } = fixture();
  const heading = new Element('h1');
  heading.setAttribute('data-repertory-heading', '');
  heading.textContent = 'Coordinate Carnival';
  root.append(heading);
  const input = projection({ lifecycle: { suspended: true } });
  const result = stageRepertoryProjection(document, input);
  assert.equal(result.operation, 'suspend');
  assert.equal(root.inert, true);
  assert.equal(heading.textContent, 'Coordinate Carnival');
});

test('fails closed before DOM mutation when privacy or commerce policy is unsafe', () => {
  const { document, root } = fixture();
  assert.throws(() => stageRepertoryProjection(document, projection({ privacy: { private_source_material: true, raw_continuity_marks_exposed: false } })), /Unsafe privacy policy/);
  assert.throws(() => stageRepertoryProjection(document, projection({ commerce: { payment_logic: false, conversion_logic: true } })), /Commerce logic/);
  assert.equal(root.getAttribute('data-production-id'), null);
});

test('returns a bounded reversible identity record when the root is absent', () => {
  const { document } = fixture(false);
  assert.deepEqual(stageRepertoryProjection(document, projection()), {
    staged: false,
    reason: 'target_missing',
    operation: 'replace',
    production_id: 'coordinate-carnival',
    mount_key: '2026-07-14T11:00-04:00/coordinate-carnival',
  });
});
