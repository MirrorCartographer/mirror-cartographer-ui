import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRepertoryMountPlan } from '../studio/repertory-dom-adapter.mjs';

class Element {
  constructor(tag = 'div') { this.tagName = tag; this.attrs = new Map(); this.children = []; this.parent = null; this.textContent = ''; this.inert = false; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  append(node) { node.parent = this; this.children.push(node); }
  contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false; }
  querySelector(selector) {
    const match = selector.match(/^\[([^\]]+)\]$/);
    if (!match) return null;
    const attr = match[1];
    return this.children.find((child) => child.attrs.has(attr)) ?? null;
  }
}

function fixture() {
  const root = new Element('main');
  const button = new Element('button');
  root.append(button);
  const body = new Element('body');
  const document = {
    body,
    activeElement: button,
    querySelector(selector) { return selector === '[data-mirror-repertory-root]' ? root : null; },
    createElement(tag) { return new Element(tag); },
  };
  return { document, root, button };
}

function plan(overrides = {}) {
  return {
    schema_version: 1,
    operation: 'replace',
    target: { selector: '[data-mirror-repertory-root]', tag: 'section' },
    attributes: {
      'data-production-id': 'coordinate-carnival',
      'data-production-form': 'stage',
      'data-continuity-channel': 'shared-state',
      'data-continuity-revision': '9',
      role: 'region',
      'aria-label': 'Coordinate Carnival — stage',
      'aria-live': 'off',
      inert: false,
    },
    content: { heading: 'Coordinate Carnival', visual_grammar: 'hand-drawn coordinates and orbital type', status: 'Coordinate Carnival is on stage.' },
    behavior: { preserve_focus: true, focus_target: null, autoplay: false, audio_start_requires_user_gesture: true, network_requests: false, persistence: false },
    ...overrides,
  };
}

test('applies production content without replacing a focused descendant', () => {
  const { document, root, button } = fixture();
  const result = applyRepertoryMountPlan(document, plan());
  assert.equal(document.activeElement, button);
  assert.equal(root.contains(button), true);
  assert.equal(result.focus_preserved, true);
  assert.equal(result.content_strategy, 'in_place_focused');
  assert.equal(root.querySelector('[data-repertory-heading]').textContent, 'Coordinate Carnival');
});

test('suspends in place and retains content', () => {
  const { document, root } = fixture();
  const heading = new Element('h1');
  heading.setAttribute('data-repertory-heading', '');
  heading.textContent = 'Existing production';
  root.append(heading);
  const result = applyRepertoryMountPlan(document, plan({ operation: 'suspend', attributes: { ...plan().attributes, inert: true } }));
  assert.equal(root.inert, true);
  assert.equal(root.attrs.get('data-repertory-suspended'), 'true');
  assert.equal(heading.textContent, 'Existing production');
  assert.equal(result.content_strategy, 'retained');
});

test('fails closed on side effects and unsafe media behavior', () => {
  const { document } = fixture();
  assert.throws(() => applyRepertoryMountPlan(document, plan({ behavior: { ...plan().behavior, network_requests: true } })), /External side effects/);
  assert.throws(() => applyRepertoryMountPlan(document, plan({ behavior: { ...plan().behavior, autoplay: true } })), /Unsafe media behavior/);
});

test('returns a bounded result when the mount target is absent', () => {
  const { document } = fixture();
  document.querySelector = () => null;
  assert.deepEqual(applyRepertoryMountPlan(document, plan()), { applied: false, reason: 'target_missing', operation: 'replace' });
});
