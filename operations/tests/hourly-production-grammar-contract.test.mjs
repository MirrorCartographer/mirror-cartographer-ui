import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedulePath = new URL('../repertory/hourly-productions.json', import.meta.url);

async function schedule() {
  return JSON.parse(await readFile(schedulePath, 'utf8'));
}

test('hourly repertory is a complete deterministic 24-production cycle', async () => {
  const value = await schedule();
  const productions = value.productions;

  assert.equal(value.schema_version, 1);
  assert.equal(value.time_zone, 'America/New_York');
  assert.equal(productions.length, 24);
  assert.deepEqual(productions.map(({ hour }) => hour), Array.from({ length: 24 }, (_, hour) => hour));
  assert.equal(new Set(productions.map(({ id }) => id)).size, 24);
  assert.equal(new Set(productions.map(({ continuity_channel }) => continuity_channel)).size, 1);
  assert.equal(productions[0].continuity_channel, value.continuity_channel);
});

test('every production enforces consent, accessibility, mobile safety, and reversibility', async () => {
  const { productions } = await schedule();

  for (const production of productions) {
    assert.equal(production.autoplay, false, `${production.id} must not autoplay`);
    assert.equal(production.payment_or_conversion_logic, false, `${production.id} must not contain payment or conversion logic`);
    assert.equal(production.mobile_safe, true, `${production.id} must remain mobile-safe`);
    assert.equal(production.accessible, true, `${production.id} must remain accessible`);
    assert.equal(production.reversible, true, `${production.id} must remain reversible`);
    assert.match(production.sound, /^(silent by default|manual |optional |user-initiated |captioned manual )/i, `${production.id} sound must be silent or explicitly initiated`);
  }
});

test('every production preserves provenance classes and a public-only privacy boundary', async () => {
  const value = await schedule();

  assert.match(value.privacy_boundary, /Public production grammar only/i);
  assert.match(value.privacy_boundary, /no private source text/i);
  assert.match(value.privacy_boundary, /no .*credentials/i);
  assert.match(value.privacy_boundary, /no .*conversion logic/i);

  for (const production of value.productions) {
    const provenance = production.provenance;
    assert.ok(Array.isArray(provenance.observed) && provenance.observed.length > 0, `${production.id} needs observed provenance`);
    assert.ok(Array.isArray(provenance.inferred) && provenance.inferred.length > 0, `${production.id} needs inferred provenance`);
    assert.ok(Array.isArray(provenance.experiment) && provenance.experiment.length > 0, `${production.id} needs an experiment provenance entry`);
    assert.equal(typeof provenance.current_decision, 'string');
    assert.ok(provenance.current_decision.trim().length > 0, `${production.id} needs a current decision`);
  }
});
