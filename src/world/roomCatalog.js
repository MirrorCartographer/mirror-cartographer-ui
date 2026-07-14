const PALETTES = [
  ['#050510','#18213f','#ffe2bf','#7dd3fc'],['#090611','#351d4a','#ffd1dc','#c4b5fd'],
  ['#041316','#0c4a4e','#a7f3d0','#fde68a'],['#140b08','#5b2b19','#ffbe74','#fff0c7'],
  ['#060a16','#12305a','#91d8ff','#effbff'],['#100612','#481b3d','#f9a8d4','#f0abfc'],
  ['#07110b','#183d2b','#86efac','#fef3c7'],['#0b0714','#2e1d55','#c4b5fd','#67e8f9'],
  ['#111008','#4a4018','#fde047','#fef9c3'],['#070d12','#17354a','#93c5fd','#dbeafe'],
  ['#12080a','#4c1d2d','#fda4af','#fed7aa']
];

const FORMS = ['orbital','tide','spore','crystal','thread','mirror','hive','storm','garden','clock','ember','choir','maze'];
const MOTIONS = ['breathe','drift','swarm','fold','orbit','fall','pulse','spiral','scatter','weave','echo'];
const INTERACTIONS = ['tap','hold','trace','circle','alternate','stillness','rapid','edge','center','sequence'];
const AUDIO = ['glass','wind','water','bell','hum','pluck','choir','drum','spark','bass','chime'];

function hash(input) {
  let h = 2166136261;
  for (const ch of String(input)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick(list, seed, offset = 0) { return list[(seed + offset * 2654435761) % list.length]; }
function frac(seed, offset = 0) { return ((hash(`${seed}:${offset}`) % 10000) / 10000); }

export const ROOM_COUNT = 79;
export const LAYERS_PER_ROOM = 20;

export const ROOMS = Array.from({ length: ROOM_COUNT }, (_, index) => {
  const id = index + 1;
  const seed = hash(`mirror-room-${id}`);
  const primary = pick(FORMS, seed, 1);
  const secondary = pick(FORMS.filter((x) => x !== primary), seed, 2);
  const motion = pick(MOTIONS, seed, 3);
  const interaction = pick(INTERACTIONS, seed, 4);
  const audio = pick(AUDIO, seed, 5);
  const palette = pick(PALETTES, seed, 6);
  const layers = Array.from({ length: LAYERS_PER_ROOM }, (_, layerIndex) => ({
    index: layerIndex + 1,
    seed: hash(`${seed}:layer:${layerIndex + 1}`),
    density: 0.22 + frac(seed, layerIndex) * 0.78,
    rotation: frac(seed, layerIndex + 31) * Math.PI * 2,
    scale: 0.7 + frac(seed, layerIndex + 71) * 1.9,
    harmonic: 36 + ((seed + layerIndex * 7) % 48),
    threshold: Math.max(2, 3 + Math.floor(frac(seed, layerIndex + 91) * 8)),
    form: pick(FORMS, seed, layerIndex + 11),
    motion: pick(MOTIONS, seed, layerIndex + 17),
  }));
  return {
    id, seed, primary, secondary, motion, interaction, audio, palette, layers,
    unlockCost: id === 1 ? 0 : 8 + Math.floor(id * 1.7),
    portalShape: 3 + (seed % 8),
    gravity: frac(seed, 120) * 2 - 1,
    tempo: 52 + (seed % 78),
  };
});

export function roomById(id) { return ROOMS[Math.max(0, Math.min(ROOM_COUNT - 1, Number(id) - 1))]; }
