import fs from 'node:fs';
import path from 'node:path';

const seedPath = path.resolve('src/data/reexperience.seed.json');
const raw = fs.readFileSync(seedPath, 'utf8');
const data = JSON.parse(raw);

const requiredRoot = ['version', 'purpose', 'beats'];
const requiredBeat = [
  'id',
  'order',
  'source',
  'excerpt',
  'capsule',
  'signals',
  'motifs',
  'feltWeather',
  'musicHint',
  'proofStatus',
  'privacy',
  'firstPassNote',
  'siteGesture',
];

const allowedWeather = new Set(['cloud', 'rain', 'murmur', 'aurora', 'dawn', 'wind', 'lightning', 'clear']);
const errors = [];

for (const key of requiredRoot) {
  if (!(key in data)) errors.push(`missing root key: ${key}`);
}

if (!Array.isArray(data.beats)) {
  errors.push('beats must be an array');
} else {
  const ids = new Set();
  let lastOrder = -Infinity;
  data.beats.forEach((beat, index) => {
    for (const key of requiredBeat) {
      if (!(key in beat)) errors.push(`beat ${index} missing key: ${key}`);
    }
    if (typeof beat.id !== 'string' || !beat.id.trim()) errors.push(`beat ${index} id must be a nonempty string`);
    if (ids.has(beat.id)) errors.push(`duplicate beat id: ${beat.id}`);
    ids.add(beat.id);
    if (!Number.isFinite(beat.order)) errors.push(`beat ${beat.id} order must be numeric`);
    if (Number.isFinite(beat.order) && beat.order < lastOrder) errors.push(`beat ${beat.id} order is not chronological`);
    if (Number.isFinite(beat.order)) lastOrder = beat.order;
    if (!Array.isArray(beat.signals) || beat.signals.length === 0) errors.push(`beat ${beat.id} needs at least one signal`);
    if (!Array.isArray(beat.motifs) || beat.motifs.length === 0) errors.push(`beat ${beat.id} needs at least one motif`);
    if (!allowedWeather.has(beat.feltWeather)) errors.push(`beat ${beat.id} has unknown feltWeather: ${beat.feltWeather}`);
    for (const key of ['capsule', 'firstPassNote', 'siteGesture']) {
      if (typeof beat[key] !== 'string' || beat[key].trim().length < 8) errors.push(`beat ${beat.id} ${key} is too thin`);
    }
  });
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`reexperience seed ok: ${data.beats.length} beats`);
