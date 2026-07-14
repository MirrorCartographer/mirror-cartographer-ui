import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const previewPath = new URL('../previews/night-office/index.html', import.meta.url);
const html = readFileSync(previewPath, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function element(initial = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    value: '',
    textContent: '',
    attributes: new Map(),
    ...initial,
    addEventListener(type, handler) { listeners.set(type, handler); },
    dispatch(type) {
      const handler = listeners.get(type);
      assert.ok(handler, `missing ${type} listener`);
      return handler({ target: this, currentTarget: this });
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name); },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
}

function createHarness() {
  const nodes = {
    '#frequency': element({ value: '4' }),
    '#transmission': element(),
    '#coordinates': element(),
    '#frequency-readout': element(),
    '#status': element({ textContent: 'Line open. No account required. Sound remains off until enabled.' }),
    '#receive': element(),
    '#audio': element(),
    '#lamp': element()
  };
  nodes['#audio'].setAttribute('aria-pressed', 'false');

  const audio = { instances: 0, started: 0, closed: 0, targetFrequencies: [] };
  class AudioContext {
    constructor() { audio.instances += 1; this.currentTime = 10; this.destination = {}; }
    createOscillator() {
      return {
        type: '',
        frequency: {
          value: 0,
          setTargetAtTime(value) { audio.targetFrequencies.push(value); }
        },
        connect() { return this; },
        start() { audio.started += 1; }
      };
    }
    createGain() {
      return { gain: { value: 0 }, connect() { return this; } };
    }
    async close() { audio.closed += 1; }
  }

  const context = vm.createContext({
    document: { querySelector(selector) { return nodes[selector]; } },
    AudioContext,
    Number,
    String
  });
  vm.runInContext(script, context, { filename: 'night-office/index.html' });
  return { nodes, audio };
}

test('preview preserves the independent, accessible, responsive boundary', () => {
  assert.match(html, /<title>The Night Office for Lost Weather<\/title>/);
  assert.match(html, /<section class="console" aria-labelledby="transmission-label">/);
  assert.match(html, /class="screen" aria-live="polite"/);
  assert.match(html, /<label for="frequency">Frequency<\/label>/);
  assert.match(html, /id="audio"[^>]*aria-pressed="false"/);
  assert.match(html, /@media\(max-width:620px\)/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{\.screen:after\{animation:none\}\}/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|analytics|payment|checkout|subscribe|account creation/i);
});

test('all twelve deterministic transmissions render with stable coordinates', () => {
  const { nodes } = createHarness();
  const seen = new Set();
  for (let i = 0; i < 12; i += 1) {
    nodes['#frequency'].value = String(i);
    nodes['#frequency'].dispatch('input');
    seen.add(nodes['#transmission'].textContent);
    assert.equal(nodes['#frequency-readout'].textContent, `${String(i).padStart(2, '0')} / 11`);
    assert.equal(nodes['#coordinates'].textContent, `SECTOR ${String((i * 7 + 13) % 97).padStart(2, '0')} · ${String(310 + i * 9).padStart(3, '0')} kHz`);
  }
  assert.equal(seen.size, 12);
});

test('receive control advances and wraps without randomness', () => {
  const { nodes } = createHarness();
  nodes['#frequency'].value = '11';
  nodes['#receive'].dispatch('click');
  assert.equal(nodes['#frequency'].value, 0);
  assert.equal(nodes['#frequency-readout'].textContent, '00 / 11');
  assert.equal(nodes['#status'].textContent, 'Condition received and held for local inspection.');
});

test('audio remains opt-in and exposes its state', async () => {
  const { nodes, audio } = createHarness();
  assert.equal(audio.instances, 0);
  assert.equal(nodes['#audio'].getAttribute('aria-pressed'), 'false');

  await nodes['#audio'].dispatch('click');
  assert.equal(audio.instances, 1);
  assert.equal(audio.started, 1);
  assert.equal(nodes['#audio'].getAttribute('aria-pressed'), 'true');
  assert.equal(nodes['#lamp'].classList.contains('on'), true);
  assert.equal(nodes['#status'].textContent, 'Signal tone enabled by user gesture.');

  nodes['#frequency'].value = '7';
  nodes['#frequency'].dispatch('input');
  assert.deepEqual(audio.targetFrequencies, [251]);

  await nodes['#audio'].dispatch('click');
  assert.equal(audio.closed, 1);
  assert.equal(nodes['#audio'].getAttribute('aria-pressed'), 'false');
  assert.equal(nodes['#lamp'].classList.contains('on'), false);
  assert.equal(nodes['#status'].textContent, 'Signal tone disabled.');
});
