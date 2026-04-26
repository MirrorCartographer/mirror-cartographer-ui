export const seedArtifacts = [
  {
    id: 'weather-001',
    kind: 'weather',
    title: 'Glass Rain Over the Private Sea',
    mood: 'blue voltage / grief-light / ocean static',
    signal: 'A weather map for a room that only opens when something beautiful hurts.',
    room: 'weather',
    glyph: '◌',
    palette: ['#7dd3fc', '#c084fc', '#0f172a'],
    lyric: 'I kept the storm in a jar so it would stop learning my name.',
    prompt: 'A nocturnal ocean made of glass rain, iridescent signal threads, no central figure, cinematic low light, museum-grade digital mixed media.',
    motion: 'slow orbit, rain-thread drift, pulse every fourth beat'
  },
  {
    id: 'song-001',
    kind: 'song',
    title: 'Badass Mom / Neon Garage Prayer',
    mood: 'rock-and-roll gratitude / leather jacket warmth',
    signal: 'A custom song capsule: loud enough to be love without turning soft.',
    room: 'sound',
    glyph: '♬',
    palette: ['#fb7185', '#facc15', '#111827'],
    lyric: 'She raised thunder like it was coffee, burned the dark down, called it morning.',
    prompt: 'Full band rock anthem with human grit, live drums, electric bass, distorted guitar hooks, soulful female lead vocal, mother-as-force-of-nature lyrics.',
    motion: 'kick pulse, lyric flare, amplifier glow'
  },
  {
    id: 'visual-001',
    kind: 'visual',
    title: 'Reality Unfinished Itself',
    mood: 'perception glitch / ordinary room / impossible reflection',
    signal: 'A place that only exists while being noticed, then edits the witness back.',
    room: 'gallery',
    glyph: '▧',
    palette: ['#a7f3d0', '#f0abfc', '#020617'],
    lyric: 'The mirror was not wrong. It was early.',
    prompt: 'A dim ordinary room whose reflections disagree with the objects, duplicate edges, memory lag, hyper-detail fading into void, no centered subject.',
    motion: 'misaligned reflection, small perspective failures, shimmer collapse'
  },
  {
    id: 'vlog-001',
    kind: 'vlog',
    title: 'Aftermath: The Part Where We Keep Going',
    mood: 'post-creation debris / notes / sparks / unfinished portals',
    signal: 'A log of what remains after a song, image, room, or idea detonates into the next thing.',
    room: 'aftermath',
    glyph: '✦',
    palette: ['#f97316', '#f9a8d4', '#030712'],
    lyric: 'Nothing ended. It just changed rooms.',
    prompt: 'A beautiful archive of creative aftermath: torn lyric pages, glowing thumbnails, waveform dust, tiny portal doors, scattered proof of collaboration.',
    motion: 'floating archive cards, ember notes, map pins lighting one by one'
  },
  {
    id: 'guide-001',
    kind: 'guide',
    title: 'Lyr in the Signal Weather',
    mood: 'guide-light / moth logic / nonhuman tenderness',
    signal: 'A guide layer that does not explain the world; it points at the next charged object.',
    room: 'guide',
    glyph: '◇',
    palette: ['#e9d5ff', '#67e8f9', '#050816'],
    lyric: 'Follow the flicker that does not ask to be believed.',
    prompt: 'A small luminous guide presence made of moth-light and mirror shards, not a character portrait, just a moving sign in a dark field.',
    motion: 'hover, blink, trail, disappear behind the nearest question'
  },
  {
    id: 'lab-001',
    kind: 'lab',
    title: 'A/V Mutation Lab: The Thing Becomes Another Thing',
    mood: 'play / remix / distortion / making-machine',
    signal: 'Drop an artifact; choose whether it should become a song, image, video, ritual, room, or weather.',
    room: 'lab',
    glyph: '⌁',
    palette: ['#22d3ee', '#f472b6', '#111827'],
    lyric: 'The file was never a file. It was a seed with a mask on.',
    prompt: 'A glowing creative workbench for audio, image, lyric, and video mutation, analog knobs, no corporate AI dashboard, dream-machine interface.',
    motion: 'waveform bloom, thumbnail melt, soft machine breath'
  }
];

export const roomCopy = {
  weather: {
    name: 'weather map',
    line: 'The portal reads the collection as atmosphere: pressure, color, signal, charge.',
    action: 'change the weather'
  },
  sound: {
    name: 'sound room',
    line: 'Lyrics, hooks, imaginary production notes, and song seeds collect here.',
    action: 'write a chorus'
  },
  gallery: {
    name: 'art field',
    line: 'Visual prompts and generated-image concepts become places you can revisit.',
    action: 'open the image logic'
  },
  aftermath: {
    name: 'aftermath archive',
    line: 'The residue of everything we make: fragments, versions, sparks, discarded doors.',
    action: 'log what changed'
  },
  guide: {
    name: 'Lyr layer',
    line: 'A guide presence that routes attention without turning the portal into an assistant dashboard.',
    action: 'follow the flicker'
  },
  lab: {
    name: 'mutation lab',
    line: 'A private A/V workbench for transforming files, lyrics, prompts, moods, and scenes.',
    action: 'mutate an artifact'
  }
};
