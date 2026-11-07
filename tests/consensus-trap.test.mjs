import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/field-instruments/consensus-trap.html', import.meta.url), 'utf8');
const match = html.match(/function createRng\(seed\)\s*\{[\s\S]*?\n\}/);
test('Consensus Trap exposes a reproducible seed control', () => {
  assert.match(html, /id="seed" type="number"/);
  assert.match(html, /Reuse a seed to reproduce/);
  assert.match(html, /random\(\)/);
  assert.doesNotMatch(html, /Math\.random\(\)/);
  assert.ok(match, 'seeded random generator must be present');
});
test('same seed reproduces the same sequence and different seeds diverge', () => {
  assert.ok(match, 'seeded random generator must be present');
  const createRng = vm.runInNewContext(match[0] + '; createRng');
  const a = createRng(20261103), b = createRng(20261103), c = createRng(20261104);
  const sequenceA = Array.from({ length: 20 }, () => a());
  const sequenceB = Array.from({ length: 20 }, () => b());
  const sequenceC = Array.from({ length: 20 }, () => c());
  assert.deepEqual(sequenceA, sequenceB);
  assert.notDeepEqual(sequenceA, sequenceC);
  assert.ok(sequenceA.every(value => value >= 0 && value < 1));
});

test('panel-size control permits even panels so tie behavior is reachable', () => {
  assert.match(html, /id="count" type="range" min="1" max="30" step="1"/);
  assert.match(html, /even-sized panels can produce ties/);
  assert.match(html, /if\(maj===1\)correct\+\+;else if\(maj===0\)ties\+\+/);
});

test('reports the denominator and treatment of tied cases explicitly', () => {
  assert.match(html, /CORRECT-MAJORITY RATE/);
  assert.match(html, /uses all simulated cases as its denominator/);
  assert.match(html, /Ties are reported separately and are not counted as correct majorities/);
});

test('offers a reproducible run-record export with model and parameter provenance', () => {
  assert.match(html, /id="export-run"/);
  assert.match(html, /experiment_id:'consensus-trap'/);
  assert.match(html, /model_version:'seeded-panel-v1'/);
  assert.match(html, /parameters:\{signal_strength:signal,shared_bias_probability:bias,independent_noise_probability:noise,panel_size:n,trials:N\}/);
  assert.match(html, /metrics:\{correct_majority_rate:a,panel_agreement_rate:g,unanimous_case_rate:u,unanimously_wrong_rate:w,tie_rate:tied\}/);
  assert.match(html, /consensus-trap-seed-/);
});

test('run-record download keeps its object URL alive through browser handoff', () => {
  assert.match(html, /document\.body\.append\(link\);link\.click\(\);link\.remove\(\)/);
  assert.match(html, /setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),1000\)/);
});

test('exportRun serializes the configured record and completes the download handoff', () => {
  const match = html.match(/function exportRun\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, 'exportRun function must exist');
  const events = [];
  let capturedBlob;
  const link = {
    href: '',
    download: '',
    click() { events.push('click'); },
    remove() { events.push('remove'); },
  };
  class FakeBlob {
    constructor(parts, options) { this.text = parts.join(''); this.type = options.type; }
  }
  const context = {
    lastRun: {
      schema_version: '1.0.0',
      experiment_id: 'consensus-trap',
      model_version: 'seeded-panel-v1',
      seed: 42,
      parameters: { panel_size: 4, trials: 100 },
      metrics: { tie_rate: 0.25 },
    },
    simulate() { throw new Error('simulate should not be needed when a run exists'); },
    Blob: FakeBlob,
    URL: {
      createObjectURL(blob) { capturedBlob = blob; events.push('create'); return 'blob:fixture'; },
      revokeObjectURL(url) { events.push(['revoke', url]); },
    },
    document: {
      body: { append(node) { assert.equal(node, link); events.push('append'); } },
      createElement() { return link; },
    },
    window: {
      setTimeout(callback, delay) { events.push(['delay', delay]); callback(); },
    },
  };
  vm.runInNewContext(match[0] + '; exportRun();', context);
  assert.equal(link.download, 'consensus-trap-seed-42.json');
  assert.equal(link.href, 'blob:fixture');
  assert.equal(capturedBlob.type, 'application/json');
  const record = JSON.parse(capturedBlob.text);
  assert.equal(record.model_version, 'seeded-panel-v1');
  assert.equal(record.parameters.panel_size, 4);
  assert.equal(record.metrics.tie_rate, 0.25);
  assert.deepEqual(events, ['create', 'append', 'click', 'remove', ['delay', 1000], ['revoke', 'blob:fixture']]);
});


function runSimulation(overrides = {}) {
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.indexOf('</script>', scriptStart);
  assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'the experiment script must exist');
  const scriptText = html.slice(scriptStart + '<script>'.length, scriptEnd);
  const defaults = { signal: '70', bias: '0', noise: '15', count: '5', trials: '2000', seed: '20261103' };
  const values = { ...defaults, ...overrides };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: values[id] ?? '', textContent: '', innerHTML: '', style: {},
      listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; },
    });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: element },
    Math, Number, String, Array, Set, JSON,
  };
  vm.runInNewContext(scriptText + '\nglobalThis.__runRecord = lastRun;', context);
  return context.__runRecord;
}

test('the actual simulation produces reproducible bounded metrics and handles one evaluator', () => {
  const first = runSimulation({ seed: '19', count: '7', trials: '1200' });
  const second = runSimulation({ seed: '19', count: '7', trials: '1200' });
  assert.deepEqual(JSON.parse(JSON.stringify(first.metrics)), JSON.parse(JSON.stringify(second.metrics)));
  for (const [name, value] of Object.entries(first.metrics)) {
    if (name === 'panel_agreement_rate') continue;
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, name + ' must be a rate in [0, 1]');
  }
  assert.ok(first.metrics.panel_agreement_rate >= 0 && first.metrics.panel_agreement_rate <= 1);

  const solo = runSimulation({ count: '1', trials: '100', seed: '19' });
  assert.equal(solo.metrics.panel_agreement_rate, null);
  assert.equal(solo.metrics.tie_rate, 0);
  assert.ok(solo.metrics.correct_majority_rate >= 0 && solo.metrics.correct_majority_rate <= 1);
});

 
test('shared-bias extremes distinguish unanimous error from correct consensus', () => {
  const biased = runSimulation({ signal: '100', bias: '100', noise: '0', count: '5', trials: '200', seed: '7' });
  assert.equal(biased.metrics.correct_majority_rate, 0);
  assert.equal(biased.metrics.unanimously_wrong_rate, 1);
  assert.equal(biased.metrics.panel_agreement_rate, 1);

  const evidenceOnly = runSimulation({ signal: '100', bias: '0', noise: '0', count: '5', trials: '200', seed: '7' });
  assert.equal(evidenceOnly.metrics.correct_majority_rate, 1);
  assert.equal(evidenceOnly.metrics.unanimously_wrong_rate, 0);
  assert.equal(evidenceOnly.metrics.panel_agreement_rate, 1);
});

 
test('even-sized panels produce reachable ties in the executable simulation', () => {
  const run = runSimulation({ signal: '50', bias: '0', noise: '0', count: '2', trials: '400', seed: '7' });
  assert.ok(run.metrics.tie_rate > 0 && run.metrics.tie_rate < 1);
  assert.ok(run.metrics.correct_majority_rate < 1);
  assert.ok(run.sample.some(outcome => outcome.tie));
});

 
test('experiment markup contains no visible newline escape before method notes', () => {
  assert.equal(html.includes(String.raw`\n<p class="method-note">`), false);
  assert.equal(html.includes('</div>\n<p class="method-note">'), true);
});
