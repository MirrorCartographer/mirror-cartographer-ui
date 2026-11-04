const PALETTES = [
  ['#090c09','#20291f','#d8c6a1','#829078'],
  ['#0c0a0a','#2b211b','#c6a27a','#815e4d'],
  ['#081011','#1c2b2a','#b4c2b1','#698a83'],
  ['#100d09','#33261a','#d3b27b','#8d5b43'],
  ['#0a0c12','#1c2530','#c1c3bd','#74899b'],
  ['#100c11','#2d2028','#d1b2a5','#92717e'],
  ['#0b100b','#203021','#c5cfa6','#73896a'],
  ['#0d0b13','#272230','#c5b8a0','#827b9b'],
  ['#121108','#302d1d','#cbbd83','#8e8051'],
  ['#091014','#1c2a30','#b9c9c2','#66868b'],
  ['#120c0b','#33211f','#d0b49b','#966454']
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
    portalShape: 3 + (seed % 8),
    gravity: frac(seed, 120) * 2 - 1,
    tempo: 52 + (seed % 78),
  };
});

export function roomById(id) { return ROOMS[Math.max(0, Math.min(ROOM_COUNT - 1, Number(id) - 1))]; }
