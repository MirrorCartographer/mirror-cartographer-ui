import test from 'node:test';
import assert from 'node:assert/strict';
import { SemanticOS } from './kernel.mjs';

test('context transition explains gain, loss, and context-only inference', () => {
  const os = new SemanticOS();
  os.put({ id: 'body', type: 'observation', label: 'felt contraction' });
  os.put({ id: 'weather', type: 'observation', label: 'storm arrival' });
  os.put({ id: 'pattern', type: 'idea', label: 'shared timing pattern' });
  os.put({ id: 'symbolic', type: 'context', label: 'symbolic', data: { includeIds: ['body','weather','pattern'], includeTypes: ['context'] } });
  os.put({ id: 'clinical', type: 'context', label: 'clinical', data: { includeIds: ['body'], includeTypes: ['context'] } });
  os.link({ from: 'body', to: 'pattern', relation: 'supports', confidence: 0.8, contextIds: ['symbolic'] });
  os.link({ from: 'pattern', to: 'weather', relation: 'supports', confidence: 0.7, contextIds: ['symbolic'] });
  os.switchContext('clinical', { kind: 'safety_boundary' });
  const transition = os.switchContext('symbolic', { kind: 'user_goal', goal: 'inspect cross-domain meaning' });
  assert.deepEqual(new Set(transition.becameVisible), new Set(['weather','pattern']));
  assert.equal(transition.becameImpossible.length, 0);
  assert.equal(transition.newInferences[0].kind, 'transitive_support');
  assert.equal(transition.why.goal, 'inspect cross-domain meaning');
});

test('semantic objects mutate by version instead of becoming text blobs', () => {
  const os = new SemanticOS();
  const first = os.put({ id: 'idea', type: 'idea', label: 'context changes inference', confidence: 0.4 });
  const second = os.mutate('idea', { confidence: 0.7 }, 'new evidence');
  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.notEqual(first.digest, second.digest);
  assert.equal(second.provenance.at(-1).reason, 'new evidence');
});

test('discovery lab updates hypothesis confidence from experiment results', () => {
  const os = new SemanticOS();
  os.put({ id: 'o1', type: 'observation', label: 'repeatable response' });
  const hypothesis = os.proposeHypothesis({ label: 'response depends on context', observations: ['o1'] });
  const experiment = os.designExperiment({ hypothesisId: hypothesis.id, variable: 'context', intervention: 'switch frame', expected: 'response changes', falsifier: 'response invariant' });
  const result = os.recordResult(experiment.id, { outcome: 'supports', quality: 1 });
  assert.ok(result.hypothesis.confidence > hypothesis.confidence);
  assert.equal(result.experiment.data.results.length, 1);
});

test('visual emotion and generative world produce renderable state', () => {
  const os = new SemanticOS();
  const frame = os.emotionalFrame({ label: 'alert coherence', dimensions: { intensity: 0.8, activation: 0.6, valence: -0.2, coherence: 0.7 }, symbols: ['eye','storm'] });
  assert.equal(frame.visual.orbitCount, 2);
  assert.equal(frame.visual.topology, 'contracting');
  const world = os.evolveWorld({ label: 'memory field', rules: { decay: 0.01 }, seedObjects: [{ id: 'a', energy: 0.5, speed: 1 }] });
  const next = os.stepWorld(world.id, { delta: 0.1, energy: 0.05 });
  assert.equal(next.data.generation, 1);
  assert.ok(next.data.entities[0].energy > 0.5);
});

test('browser workspace opens, annotates, and compares semantic artifacts', () => {
  const os = new SemanticOS();
  const browser = os.browserWorkspace();
  const left = browser.open({ title: 'Source A', url: 'https://example.invalid/a' });
  const right = browser.open({ title: 'Source B', url: 'https://example.invalid/b' });
  browser.annotate(left.id, { quote: 'claim', status: 'observed' });
  const comparison = browser.compare(left.id, right.id, ['claim','evidence']);
  assert.equal(os.require(left.id).data.annotations.length, 1);
  assert.equal(comparison.type, 'artifact');
  assert.equal([...os.edges.values()].filter((edge) => edge.from === comparison.id).length, 2);
});
