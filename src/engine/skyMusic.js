const SCALE = [0, 2, 3, 5, 7, 8, 10];
const WEATHER_ROOTS = {
  cloud: 48,
  rain: 43,
  lightning: 46,
  clear: 50,
  aurora: 51,
  dawn: 53,
  wind: 45,
  murmur: 46,
};
const CHORDS = [
  [0, 3, 7, 10],
  [5, 8, 12, 15],
  [7, 10, 14, 17],
  [3, 7, 10, 14],
];
const MOTIF = [0, 2, 3, 5, 3, 2, 6, 5, 3, 1, 2, 0, 5, 6, 3, 2];
const ANSWER = [5, 3, 2, 0, 2, 3, 1, -1, 0, 2, 5, 3, 2, 0, -2, 0];
const BASS_WALK = [0, 0, 2, 4, 5, 5, 4, 2, 7, 7, 6, 5, 3, 2, 1, 0];
const FORM = ['seed', 'seed', 'lift', 'answer', 'storm', 'answer', 'lift', 'home'];
const VARIANTS = [0, 0, 1, 0, -1, 0, 2, 0];
const GROOVES = {
  cloud: { span: 8, accent: [1, 0, 0.72, 0, 0.88, 0, 0.56, 0], duration: [1, 1, 1, 1, 1, 1, 1, 1] },
  rain: { span: 12, accent: [1, 0, 0.62, 0, 0.78, 0.36, 0.9, 0, 0.56, 0, 0.72, 0.34], duration: [0.74, 0.76, 0.5, 1, 0.74, 0.76, 0.5, 1, 0.74, 0.76, 0.5, 1] },
  lightning: { span: 10, accent: [1, 0, 0, 0.92, 0, 0.55, 0, 1, 0.48, 0], duration: [0.72, 0.58, 0.7, 1.0, 0.5, 0.72, 0.58, 1.1, 0.5, 0.6] },
  clear: { span: 8, accent: [1, 0, 0.58, 0, 0.82, 0, 0.64, 0], duration: [1, 1, 1, 1, 1, 1, 1, 1] },
  aurora: { span: 14, accent: [1, 0, 0.52, 0, 0.76, 0, 0.42, 0.9, 0, 0.48, 0, 0.72, 0, 0.36], duration: [0.66, 0.84, 0.5, 1, 0.66, 0.84, 0.5, 1, 0.66, 0.84, 0.5, 1, 0.66, 0.84] },
  dawn: { span: 8, accent: [1, 0, 0.68, 0.34, 0.9, 0, 0.62, 0], duration: [1, 1, 0.74, 1.26, 1, 1, 0.74, 1.26] },
  wind: { span: 6, accent: [1, 0, 0.7, 0.52, 0, 0.84], duration: [0.84, 0.84, 1.32, 0.84, 0.84, 1.32] },
  murmur: { span: 12, accent: [1, 0.42, 0, 0.78, 0, 0.52, 0.9, 0.36, 0, 0.72, 0, 0.48], duration: [0.66, 0.84, 0.5, 1, 0.66, 0.84, 0.5, 1, 0.66, 0.84, 0.5, 1] },
};
const LOOKAHEAD_MS = 180;
const SCHEDULE_AHEAD_SECONDS = 0.85;
const MAX_EVENTS_PER_TICK = 12;
const TAP_ACCENT_COOLDOWN = 0.18;
const PHRASE_MEMORY_LIMIT = 8;

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function stateRoot(state) {
  return WEATHER_ROOTS[state] || WEATHER_ROOTS.cloud;
}

function scaleNote(root, degree, octave = 0) {
  const wrapped = ((degree % SCALE.length) + SCALE.length) % SCALE.length;
  const oct = Math.floor(degree / SCALE.length) + octave;
  return root + SCALE[wrapped] + oct * 12;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function currentBeatSeconds(state, rhythm) {
  const bpm = 74 + Math.min(16, rhythm * 2.4) + (state === 'wind' ? 8 : state === 'lightning' ? 12 : 0);
  return 60 / clamp(bpm, 62, 104);
}

function grooveFor(state, index) {
  const groove = GROOVES[state] || GROOVES.cloud;
  const slot = index % groove.span;
  return {
    accent: groove.accent[slot] ?? 0,
    duration: clamp(groove.duration[slot] ?? 1, 0.45, 1.35),
  };
}

function phraseVariant(phrase, inPhrase, section) {
  if (section === 'home' && inPhrase >= 12) return 0;
  if (section === 'storm') return inPhrase % 4 === 3 ? 3 : VARIANTS[(phrase + inPhrase) % VARIANTS.length];
  if (section === 'answer') return -VARIANTS[(phrase * 2 + inPhrase) % VARIANTS.length];
  return VARIANTS[(phrase + Math.floor(inPhrase / 2)) % VARIANTS.length];
}

function shouldRest(section, inPhrase, accent) {
  if (section === 'home' && inPhrase === 15) return true;
  if (section === 'seed' && (inPhrase === 7 || inPhrase === 15)) return true;
  return accent === 0;
}

function closestRegister(note, target) {
  let best = note;
  let distance = Math.abs(note - target);
  for (let shift = -24; shift <= 24; shift += 12) {
    const candidate = note + shift;
    const candidateDistance = Math.abs(candidate - target);
    if (candidateDistance < distance) {
      best = candidate;
      distance = candidateDistance;
    }
  }
  return best;
}

function voiceChord(root, chord, previous, lift) {
  const targets = previous?.length ? previous : [root + 48, root + 52, root + 55, root + 60];
  return chord.map((offset, voice) => {
    const colorLift = lift && voice > 1 ? 12 : 0;
    const base = root + offset + 12 + colorLift;
    const target = targets[voice] ?? targets.at(-1) ?? root + 60;
    return closestRegister(base, target);
  });
}

function memoryTurn(memory, inPhrase, section) {
  if (!memory.length || section === 'home') return 0;
  const remembered = memory[inPhrase % memory.length];
  if (!remembered) return 0;
  const pull = Math.sign(remembered.degree) * Math.min(2, Math.round(Math.abs(remembered.degree) / 4));
  if (section === 'answer') return -pull;
  if (section === 'storm') return pull * 2;
  return pull;
}

function makeNoiseBuffer(ctx, seconds = 1.2) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    last = last * 0.86 + (Math.random() * 2 - 1) * 0.14;
    data[i] = last;
  }
  return buffer;
}

function envGain(ctx, destination, start, attack, decay, peak) {
  const gain = ctx.createGain();
  const safeStart = Math.max(ctx.currentTime + 0.004, start);
  const safeAttack = Math.max(0.006, attack);
  const safeDecay = Math.max(0.04, decay);
  gain.gain.setValueAtTime(0.0001, safeStart);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), safeStart + safeAttack);
  gain.gain.exponentialRampToValueAtTime(0.0001, safeStart + safeAttack + safeDecay);
  gain.connect(destination);
  return gain;
}

function playOsc(ctx, destination, when, hz, duration, options = {}) {
  const start = Math.max(ctx.currentTime + 0.004, when);
  const osc = ctx.createOscillator();
  const gain = envGain(ctx, destination, start, options.attack ?? 0.018, duration, options.gain ?? 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filterType || 'lowpass';
  filter.frequency.setValueAtTime(options.filter ?? 1400, start);
  filter.Q.setValueAtTime(options.q ?? 0.8, start);
  osc.type = options.type || 'sine';
  osc.frequency.setValueAtTime(hz, start);
  if (options.slide) osc.frequency.exponentialRampToValueAtTime(hz * options.slide, start + duration * 0.7);
  osc.connect(filter);
  filter.connect(gain);
  osc.start(start);
  osc.stop(start + duration + 0.08);
}

function playNoise(ctx, noise, destination, when, duration, options = {}) {
  const start = Math.max(ctx.currentTime + 0.004, when);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = envGain(ctx, destination, start, options.attack ?? 0.004, duration, options.gain ?? 0.025);
  source.buffer = noise;
  source.loop = true;
  filter.type = options.type || 'bandpass';
  filter.frequency.setValueAtTime(options.frequency ?? 1700, start);
  filter.Q.setValueAtTime(options.q ?? 5, start);
  source.connect(filter);
  filter.connect(gain);
  source.start(start);
  source.stop(start + duration + 0.08);
}

export function createSkyMusic() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return { supported: false, start() {}, pulse() {}, stop() {} };

  let ctx = null;
  let master = null;
  let delay = null;
  let feedback = null;
  let filter = null;
  let limiter = null;
  let noise = null;
  let timer = 0;
  let step = 0;
  let nextNoteTime = 0;
  let previousVoicing = null;
  let previousSection = FORM[0];
  let phraseMemory = [];
  let lastTapAccent = 0;
  let currentState = 'cloud';
  let currentPulse = 0.5;
  let currentRhythm = 0;
  let started = false;

  function rememberPhrase(degree) {
    phraseMemory = [
      { degree: clamp(degree, -8, 12), state: currentState },
      ...phraseMemory,
    ].slice(0, PHRASE_MEMORY_LIMIT);
  }

  function ensure() {
    if (ctx) return true;
    ctx = new Audio();
    master = ctx.createGain();
    delay = ctx.createDelay(0.8);
    feedback = ctx.createGain();
    filter = ctx.createBiquadFilter();
    limiter = ctx.createDynamicsCompressor();
    filter.type = 'lowpass';
    filter.frequency.value = 3600;
    feedback.gain.value = 0.2;
    delay.delayTime.value = 0.28;
    master.gain.value = 0.0;
    limiter.threshold.value = -18;
    limiter.knee.value = 16;
    limiter.ratio.value = 7;
    limiter.attack.value = 0.012;
    limiter.release.value = 0.22;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(filter);
    filter.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
    noise = makeNoiseBuffer(ctx);
    return true;
  }

  function playTapVoice(degree = 0, answer = false) {
    if (!ctx || !master) return;
    const root = stateRoot(currentState);
    const now = ctx.currentTime + 0.012;
    const note = scaleNote(root, degree, answer ? 1 : 2);
    playOsc(ctx, master, now, midiToHz(note), answer ? 0.32 : 0.42, {
      type: answer ? 'sine' : 'triangle',
      gain: answer ? 0.015 : 0.022,
      attack: 0.01,
      filter: answer ? 2200 : 3400,
    });
    playOsc(ctx, delay, now + 0.075, midiToHz(scaleNote(root, answer ? degree - 2 : degree + 3, 2)), 0.28, {
      type: 'sine',
      gain: 0.006,
      attack: 0.018,
      filter: 3100,
    });
  }

  function scheduleOne(when) {
    if (!ctx || !started) return;
    const beat = currentBeatSeconds(currentState, currentRhythm);
    const root = stateRoot(currentState);
    const localStep = step % 128;
    const phrase = Math.floor(localStep / 16);
    const section = FORM[phrase % FORM.length];
    const chord = CHORDS[Math.floor(localStep / 16) % CHORDS.length];
    const chordRoot = root + chord[0];
    const brightness = currentState === 'aurora' || currentState === 'dawn' || currentState === 'murmur';
    const wet = currentState === 'rain' || currentState === 'murmur' || currentState === 'aurora';
    const chorus = section === 'lift' || section === 'storm';
    const cadence = section === 'home';
    const inPhrase = localStep % 16;
    const groove = grooveFor(currentState, localStep);
    const resting = shouldRest(section, inPhrase, groove.accent);
    const slotSeconds = beat * 0.5 * groove.duration;
    const strong = groove.accent >= 0.82;
    const medium = groove.accent >= 0.52;
    const ghost = groove.accent > 0 && groove.accent < 0.52;
    const lift = section === 'lift' || section === 'storm';
    const answering = section === 'answer' || section === 'home';
    const homeCadence = section === 'home' && inPhrase >= 12;
    const contour = lift ? 4 : answering ? 1 : 0;
    const sourceMotif = answering ? ANSWER : MOTIF;
    const motifDegree = sourceMotif[inPhrase] + contour + (phrase % 2 === 0 ? 0 : 2) + phraseVariant(phrase, inPhrase, section) + memoryTurn(phraseMemory, inPhrase, section);
    const sectionChanged = inPhrase === 0 && section !== previousSection;

    delay.delayTime.setTargetAtTime(wet ? beat * 0.75 : beat * 0.5, when, 0.05);
    feedback.gain.setTargetAtTime(wet || chorus ? 0.28 : 0.14, when, 0.08);
    filter.frequency.setTargetAtTime(brightness || chorus ? 4300 : 2300, when, 0.12);

    if (sectionChanged) {
      const bridge = scaleNote(root, section === 'home' ? 0 : motifDegree - 2, 2);
      playOsc(ctx, delay, when + beat * 0.08, midiToHz(bridge), beat * 0.44, {
        type: 'triangle',
        gain: 0.007,
        filter: 4000,
      });
      previousSection = section;
    }

    if (!resting && medium && step % 2 === 0) {
      const note = homeCadence ? scaleNote(root, Math.max(0, 5 - (inPhrase - 12) * 2), 1) : scaleNote(root, motifDegree, 1 + (step % 8 === 6 || lift ? 1 : 0));
      playOsc(ctx, delay, when, midiToHz(note), slotSeconds * (lift ? 1.55 : 1.3), {
        type: brightness || lift ? 'triangle' : 'sine',
        gain: (0.012 + currentPulse * 0.008 + (lift ? 0.004 : 0)) * groove.accent,
        filter: brightness || lift ? 3600 : 2100,
      });
    } else if (!resting && ghost && !homeCadence && step % 4 === 0) {
      const grace = scaleNote(root, motifDegree - 2, 1);
      playOsc(ctx, delay, when + slotSeconds * 0.18, midiToHz(grace), slotSeconds * 0.54, {
        type: 'sine',
        gain: 0.0048 * groove.accent,
        filter: 1700,
      });
    }

    if (!resting && answering && medium && step % 4 === 2) {
      const counter = scaleNote(root, ANSWER[(15 - inPhrase + ANSWER.length) % ANSWER.length] - 3 + memoryTurn(phraseMemory, 15 - inPhrase, section), 1);
      playOsc(ctx, delay, when + slotSeconds * 0.36, midiToHz(counter), slotSeconds * 1.05, {
        type: 'sine',
        gain: (0.007 + currentPulse * 0.0025) * groove.accent,
        filter: 1800,
      });
    }

    if (strong && step % 4 === 0) {
      const walk = BASS_WALK[inPhrase] || 0;
      const bass = chordRoot - 24 + (lift ? 12 : 0) + (homeCadence ? 0 : walk);
      playOsc(ctx, master, when, midiToHz(bass), beat * (homeCadence ? 1.8 : 1.22), {
        type: 'sine',
        gain: 0.026 + (lift ? 0.003 : 0),
        attack: 0.025,
        filter: lift ? 700 : 540,
      });
    }

    if (strong && step % 8 === 0) {
      const voicing = voiceChord(root, chord, previousVoicing, lift);
      previousVoicing = voicing;
      voicing.forEach((note, voice) => {
        const release = cadence ? beat * 3.1 : beat * (lift ? 2.45 : 1.85);
        const entrance = voice * 0.012 + (sectionChanged ? beat * 0.04 * voice : 0);
        playOsc(ctx, delay, when + entrance, midiToHz(note), release, {
          type: 'triangle',
          gain: 0.0052 + (lift ? 0.0015 : 0),
          attack: 0.09 + voice * 0.018,
          filter: 1450 + voice * 390 + (lift ? 600 : 0),
        });
      });
    }

    if (lift && strong && step % 8 === 6) {
      const sparkle = scaleNote(root, motifDegree + 7, 2);
      playOsc(ctx, delay, when + slotSeconds * 0.24, midiToHz(sparkle), slotSeconds * 0.62, {
        type: 'triangle',
        gain: 0.006,
        filter: 5000,
      });
    }

    if (currentState === 'rain' && medium && step % 3 === 0) {
      playNoise(ctx, noise, delay, when, slotSeconds * 0.62, { frequency: 1750 + (step % 5) * 240, gain: 0.0048, q: 7 });
    }
    if ((currentState === 'lightning' || section === 'storm') && strong && step % 7 === 0) {
      playOsc(ctx, delay, when, midiToHz(root + 31), slotSeconds * 0.42, { type: 'sawtooth', gain: 0.0065, filter: 4600, slide: 0.72 });
    }

    step += 1;
    nextNoteTime += slotSeconds;
  }

  function scheduler() {
    if (!ctx || !started) return;
    if (nextNoteTime < ctx.currentTime - 0.1) nextNoteTime = ctx.currentTime + 0.025;
    let events = 0;
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SECONDS && events < MAX_EVENTS_PER_TICK) {
      scheduleOne(nextNoteTime);
      events += 1;
    }
  }

  async function start(snapshot = {}) {
    if (!ensure()) return false;
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.31, ctx.currentTime, 0.18);
    nextNoteTime = ctx.currentTime + 0.055;
    playTapVoice(0, false);
    scheduler();
    if (!timer) timer = window.setInterval(scheduler, LOOKAHEAD_MS);
    return true;
  }

  function pulse(snapshot = {}) {
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (!ctx || !started) return;
    if (ctx.currentTime - lastTapAccent < TAP_ACCENT_COOLDOWN) return;
    lastTapAccent = ctx.currentTime;
    const phrase = Math.floor((step % 128) / 16);
    const section = FORM[phrase % FORM.length];
    const motif = section === 'answer' || section === 'home' ? ANSWER : MOTIF;
    const degree = motif[(step + Math.round(currentRhythm)) % motif.length] + (section === 'lift' ? 5 : 0) + phraseVariant(phrase, step % 16, section);
    rememberPhrase(degree);
    playTapVoice(degree, true);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
    if (master && ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    started = false;
  }

  return { supported: true, start, pulse, stop };
}
