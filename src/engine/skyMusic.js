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
const LOOKAHEAD_MS = 180;
const SCHEDULE_AHEAD_SECONDS = 0.85;

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
  let currentState = 'cloud';
  let currentPulse = 0.5;
  let currentRhythm = 0;
  let started = false;

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
    const lift = section === 'lift' || section === 'storm';
    const answering = section === 'answer' || section === 'home';
    const homeCadence = section === 'home' && inPhrase >= 12;
    const contour = lift ? 4 : answering ? 1 : 0;
    const sourceMotif = answering ? ANSWER : MOTIF;
    const motifDegree = sourceMotif[inPhrase] + contour + (phrase % 2 === 0 ? 0 : 2);
    const sectionChanged = inPhrase === 0 && section !== previousSection;

    delay.delayTime.setTargetAtTime(wet ? beat * 0.75 : beat * 0.5, when, 0.05);
    feedback.gain.setTargetAtTime(wet || chorus ? 0.3 : 0.16, when, 0.08);
    filter.frequency.setTargetAtTime(brightness || chorus ? 4600 : 2400, when, 0.12);

    if (sectionChanged) {
      const bridge = scaleNote(root, section === 'home' ? 0 : motifDegree - 2, 2);
      playOsc(ctx, delay, when + beat * 0.08, midiToHz(bridge), beat * 0.44, {
        type: 'triangle',
        gain: 0.008,
        filter: 4200,
      });
      previousSection = section;
    }

    if (step % 2 === 0) {
      const note = homeCadence ? scaleNote(root, Math.max(0, 5 - (inPhrase - 12) * 2), 1) : scaleNote(root, motifDegree, 1 + (step % 8 === 6 || lift ? 1 : 0));
      playOsc(ctx, delay, when, midiToHz(note), beat * (lift ? 0.95 : 0.82), {
        type: brightness || lift ? 'triangle' : 'sine',
        gain: 0.02 + currentPulse * 0.012 + (lift ? 0.006 : 0),
        filter: brightness || lift ? 3800 : 2200,
      });
    }

    if (answering && step % 4 === 2) {
      const counter = scaleNote(root, ANSWER[(15 - inPhrase + ANSWER.length) % ANSWER.length] - 3, 1);
      playOsc(ctx, delay, when + beat * 0.18, midiToHz(counter), beat * 0.72, {
        type: 'sine',
        gain: 0.011 + currentPulse * 0.004,
        filter: 1900,
      });
    }

    if (step % 4 === 0) {
      const walk = BASS_WALK[inPhrase] || 0;
      const bass = chordRoot - 24 + (lift ? 12 : 0) + (homeCadence ? 0 : walk);
      playOsc(ctx, master, when, midiToHz(bass), beat * (homeCadence ? 1.8 : 1.22), {
        type: 'sine',
        gain: 0.032 + (lift ? 0.005 : 0),
        attack: 0.025,
        filter: lift ? 720 : 560,
      });
    }

    if (step % 8 === 0) {
      const voicing = voiceChord(root, chord, previousVoicing, lift);
      previousVoicing = voicing;
      voicing.forEach((note, voice) => {
        const release = cadence ? beat * 3.4 : beat * (lift ? 2.7 : 2.05);
        const entrance = voice * 0.012 + (sectionChanged ? beat * 0.04 * voice : 0);
        playOsc(ctx, delay, when + entrance, midiToHz(note), release, {
          type: 'triangle',
          gain: 0.0065 + (lift ? 0.0025 : 0),
          attack: 0.08 + voice * 0.018,
          filter: 1500 + voice * 420 + (lift ? 700 : 0),
        });
      });
    }

    if (lift && step % 8 === 6) {
      const sparkle = scaleNote(root, motifDegree + 7, 2);
      playOsc(ctx, delay, when + beat * 0.12, midiToHz(sparkle), beat * 0.34, {
        type: 'triangle',
        gain: 0.009,
        filter: 5200,
      });
    }

    if (currentState === 'rain' && step % 3 === 0) {
      playNoise(ctx, noise, delay, when, beat * 0.18, { frequency: 1800 + (step % 5) * 260, gain: 0.008, q: 7 });
    }
    if ((currentState === 'lightning' || section === 'storm') && step % 7 === 0) {
      playOsc(ctx, delay, when, midiToHz(root + 31), beat * 0.14, { type: 'sawtooth', gain: 0.009, filter: 4800, slide: 0.72 });
    }

    step += 1;
    nextNoteTime += beat * 0.5;
  }

  function scheduler() {
    if (!ctx || !started) return;
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) scheduleOne(nextNoteTime);
  }

  async function start(snapshot = {}) {
    if (!ensure()) return false;
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.34, ctx.currentTime, 0.35);
    if (!timer) {
      nextNoteTime = ctx.currentTime + 0.035;
      scheduler();
      timer = window.setInterval(scheduler, LOOKAHEAD_MS);
    }
    return true;
  }

  function pulse(snapshot = {}) {
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (!ctx || !started) return;
    const root = stateRoot(currentState);
    const phrase = Math.floor((step % 128) / 16);
    const section = FORM[phrase % FORM.length];
    const motif = section === 'answer' || section === 'home' ? ANSWER : MOTIF;
    const note = scaleNote(root, motif[(step + Math.round(currentRhythm)) % motif.length] + (section === 'lift' ? 5 : 0), 2);
    playOsc(ctx, delay, ctx.currentTime + 0.01, midiToHz(note), 0.48, { type: 'triangle', gain: 0.018, filter: section === 'lift' ? 4600 : 3200 });
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
    if (master && ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    started = false;
  }

  return { supported: true, start, pulse, stop };
}
