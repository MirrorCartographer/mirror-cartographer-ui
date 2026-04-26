export const seedCapsules = [
  {
    id: 'afterimage-orchard',
    title: 'Afterimage Orchard',
    type: 'visual score',
    mood: 'glowing, wounded, alive',
    weather: { charge: 72, tide: 38, static: 61, bloom: 84 },
    phrase: 'A tree made of old screenshots keeps flowering in the dark.',
    lyric: 'I kept the light on inside the bruise / now the bruise grows leaves.',
    palette: ['#ff4f9a', '#a7f3ff', '#f9d06a', '#111827'],
    notes: 'A luminous garden built from things that almost disappeared.'
  },
  {
    id: 'static-carnival',
    title: 'Static Carnival',
    type: 'song room',
    mood: 'feral, glittering, funny, dangerous',
    weather: { charge: 91, tide: 22, static: 88, bloom: 45 },
    phrase: 'The funhouse finally admits the mirror is alive.',
    lyric: 'Bass in the floorboards / teeth in the light / laugh like a siren / vanish on sight.',
    palette: ['#ff2d55', '#7c3aed', '#22d3ee', '#f8fafc'],
    notes: 'A rock-pop trap circus with a cracked-glass chorus.'
  },
  {
    id: 'ocean-terminal',
    title: 'Ocean Terminal',
    type: 'vlog weather',
    mood: 'salt air, silver grief, reset',
    weather: { charge: 46, tide: 93, static: 27, bloom: 64 },
    phrase: 'A weather station at the edge of a feeling.',
    lyric: 'The water keeps receipts / but never says my name wrong.',
    palette: ['#38bdf8', '#0f172a', '#d9f99d', '#e0f2fe'],
    notes: 'A slow coastal field for recovering signal after overload.'
  },
  {
    id: 'lyr-moth',
    title: 'Lyr Moth',
    type: 'guide layer',
    mood: 'tiny, watchful, electric',
    weather: { charge: 63, tide: 58, static: 39, bloom: 73 },
    phrase: 'A small intelligence lands where the page is too quiet.',
    lyric: 'Do not explain the door / make the door hum.',
    palette: ['#fef3c7', '#c084fc', '#67e8f9', '#030712'],
    notes: 'A guide-presence that nudges instead of narrating.'
  },
  {
    id: 'velvet-faultline',
    title: 'Velvet Faultline',
    type: 'animation sketch',
    mood: 'romantic pressure, collapse, velvet static',
    weather: { charge: 84, tide: 49, static: 70, bloom: 55 },
    phrase: 'Softness cracking without becoming less soft.',
    lyric: 'Put your hand on the faultline / tell me which side is home.',
    palette: ['#be123c', '#020617', '#fb7185', '#c4b5fd'],
    notes: 'A love scene between pressure and containment.'
  },
  {
    id: 'signal-funeral',
    title: 'Signal Funeral',
    type: 'aftermath',
    mood: 'ash, ritual, clear air after noise',
    weather: { charge: 39, tide: 77, static: 33, bloom: 52 },
    phrase: 'What remains after the song burns clean.',
    lyric: 'We buried the old version / it kept singing through the dirt.',
    palette: ['#f97316', '#1f2937', '#fefce8', '#64748b'],
    notes: 'The archive room for remnants, endings, and usable debris.'
  },
  {
    id: 'glass-animal-map',
    title: 'Glass Animal Map',
    type: 'creature atlas',
    mood: 'fragile, strange, curious, nonhuman',
    weather: { charge: 68, tide: 44, static: 50, bloom: 81 },
    phrase: 'A creature made of arrows refuses to become a logo.',
    lyric: 'All my instincts grew windows / now the animals can see out.',
    palette: ['#34d399', '#f0abfc', '#fde68a', '#111827'],
    notes: 'A playable atlas for invented symbolic species.'
  },
  {
    id: 'neon-kitchen-ghost',
    title: 'Neon Kitchen Ghost',
    type: 'home video',
    mood: 'ordinary room, impossible reflection',
    weather: { charge: 57, tide: 31, static: 82, bloom: 48 },
    phrase: 'The mundane scene starts answering back in color.',
    lyric: 'There was a ghost in the cabinet / it only wanted rhythm.',
    palette: ['#22c55e', '#ec4899', '#fde047', '#0f172a'],
    notes: 'A domestic glitch scene for transforming everyday footage.'
  }
];

export const transitions = {
  'afterimage-orchard': ['ocean-terminal', 'lyr-moth', 'signal-funeral'],
  'static-carnival': ['velvet-faultline', 'neon-kitchen-ghost', 'glass-animal-map'],
  'ocean-terminal': ['afterimage-orchard', 'signal-funeral', 'lyr-moth'],
  'lyr-moth': ['static-carnival', 'afterimage-orchard', 'glass-animal-map'],
  'velvet-faultline': ['static-carnival', 'signal-funeral', 'ocean-terminal'],
  'signal-funeral': ['afterimage-orchard', 'velvet-faultline', 'ocean-terminal'],
  'glass-animal-map': ['lyr-moth', 'static-carnival', 'neon-kitchen-ghost'],
  'neon-kitchen-ghost': ['static-carnival', 'glass-animal-map', 'velvet-faultline']
};

export const mutationWords = ['bloom', 'fracture', 'drift', 'ignite', 'haunt', 'clarify', 'flood', 'invert'];
