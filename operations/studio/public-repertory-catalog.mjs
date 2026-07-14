const PROVENANCE_CLASSES = new Set(['observed_preference', 'inference', 'experiment', 'current_decision']);
const AUDIO_POLICIES = new Set(['silent', 'user_initiated']);
const MOTION_POLICIES = new Set(['reducible', 'essential']);

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

function freezeProvenance(entries, productionId) {
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError(`${productionId} provenance must be a non-empty array.`);
  const seen = new Set();
  return Object.freeze(entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError(`${productionId} provenance entries must be objects.`);
    const claimClass = requireText(entry.class, 'Provenance class');
    if (!PROVENANCE_CLASSES.has(claimClass)) throw new Error(`Unsupported provenance class: ${claimClass}.`);
    if (seen.has(claimClass)) throw new Error(`${productionId} repeats provenance class ${claimClass}.`);
    seen.add(claimClass);
    return Object.freeze({
      class: claimClass,
      statement: requireText(entry.statement, 'Provenance statement'),
      source_scope: requireText(entry.source_scope, 'Provenance source scope'),
      public_safe: entry.public_safe === true,
    });
  }));
}

function freezeProduction(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Catalog productions must be objects.');
  const id = requireText(entry.id, 'Production id');
  const provenance = freezeProvenance(entry.provenance, id);
  if (provenance.some((claim) => claim.public_safe !== true)) throw new Error(`${id} includes non-public provenance.`);
  const audioPolicy = requireText(entry.audio_policy, 'Audio policy');
  const motionPolicy = requireText(entry.motion_policy, 'Motion policy');
  if (!AUDIO_POLICIES.has(audioPolicy)) throw new Error(`Unsupported audio policy: ${audioPolicy}.`);
  if (!MOTION_POLICIES.has(motionPolicy)) throw new Error(`Unsupported motion policy: ${motionPolicy}.`);
  return Object.freeze({
    id,
    title: requireText(entry.title, 'Production title'),
    renderer: requireText(entry.renderer, 'Production renderer'),
    synopsis: requireText(entry.synopsis, 'Production synopsis'),
    audio_policy: audioPolicy,
    motion_policy: motionPolicy,
    provenance,
  });
}

const CATALOG = Object.freeze([
  {
    id: 'coordinate-bloom',
    title: 'Coordinate Bloom',
    renderer: 'coordinateBloom',
    synopsis: 'A sparse field of marks gathers into temporary coordinates and releases them again.',
    audio_policy: 'silent',
    motion_policy: 'reducible',
    provenance: [
      { class: 'observed_preference', statement: 'Spatial arrangements and orbiting language are established visual preferences.', source_scope: 'privacy-reviewed project aesthetics', public_safe: true },
      { class: 'current_decision', statement: 'Render the preference as abstract coordinates without reproducing private source language.', source_scope: 'studio decision', public_safe: true },
    ],
  },
  {
    id: 'paper-weather',
    title: 'Paper Weather',
    renderer: 'paperWeather',
    synopsis: 'Layered paper-light fronts move across a hand-cut horizon.',
    audio_policy: 'silent',
    motion_policy: 'reducible',
    provenance: [
      { class: 'observed_preference', statement: 'Hand-drawn and materially imperfect surfaces recur in approved aesthetic direction.', source_scope: 'privacy-reviewed project aesthetics', public_safe: true },
      { class: 'experiment', statement: 'Test whether low-frequency layered motion can feel alive without visual noise.', source_scope: 'studio experiment', public_safe: true },
    ],
  },
  {
    id: 'signal-garden',
    title: 'Signal Garden',
    renderer: 'signalGarden',
    synopsis: 'Small signals grow, cross, and fade while the underlying continuity remains fixed.',
    audio_policy: 'user_initiated',
    motion_policy: 'reducible',
    provenance: [
      { class: 'inference', statement: 'A living system metaphor can externalize continuity without exposing its private contents.', source_scope: 'studio synthesis', public_safe: true },
      { class: 'current_decision', statement: 'Any sound remains user-initiated and optional.', source_scope: 'accessibility policy', public_safe: true },
    ],
  },
  {
    id: 'night-index',
    title: 'Night Index',
    renderer: 'nightIndex',
    synopsis: 'An index of unlabeled lights opens and closes like a nocturnal archive.',
    audio_policy: 'silent',
    motion_policy: 'essential',
    provenance: [
      { class: 'inference', statement: 'Archive structure can be communicated through rhythm and placement rather than records.', source_scope: 'studio synthesis', public_safe: true },
      { class: 'experiment', statement: 'Test a restrained essential-motion mode whose identity survives reduced ornament.', source_scope: 'studio experiment', public_safe: true },
    ],
  },
  {
    id: 'hinge-theatre',
    title: 'Hinge Theatre',
    renderer: 'hingeTheatre',
    synopsis: 'Panels pivot between incompatible scenes while one quiet axis remains unchanged.',
    audio_policy: 'user_initiated',
    motion_policy: 'reducible',
    provenance: [
      { class: 'observed_preference', statement: 'Distinct concepts and aesthetics are preferred over cosmetic variations of one page.', source_scope: 'privacy-reviewed project direction', public_safe: true },
      { class: 'current_decision', statement: 'Use reversible scene changes around a stable continuity axis.', source_scope: 'studio decision', public_safe: true },
    ],
  },
  {
    id: 'soft-machine-room',
    title: 'Soft Machine Room',
    renderer: 'softMachineRoom',
    synopsis: 'A visible mechanism breathes through diagrams that never become a dashboard.',
    audio_policy: 'silent',
    motion_policy: 'reducible',
    provenance: [
      { class: 'inference', statement: 'Systemic complexity can be staged as atmosphere rather than operational telemetry.', source_scope: 'studio synthesis', public_safe: true },
      { class: 'current_decision', statement: 'Exclude worker controls, metrics, identity systems, commerce, and conversion surfaces.', source_scope: 'public boundary policy', public_safe: true },
    ],
  },
].map(freezeProduction));

export function getPublicRepertoryCatalog() {
  return CATALOG;
}

export function getControllerProductions() {
  return Object.freeze(CATALOG.map(({ id, title, renderer, audio_policy, motion_policy }) => Object.freeze({ id, title, renderer, audio_policy, motion_policy })));
}

export function getProductionForHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Hour must be an integer from 0 through 23.');
  return CATALOG[hour % CATALOG.length];
}
