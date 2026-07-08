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
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  gain.connect(destination);
  return gain;
}

function playOsc(ctx, destination, when, hz, duration, options = {}) {
  const osc = ctx.createOscillator();
  const gain = envGain(ctx, destination, when, options.attack ?? 0.018, duration, options.gain ?? 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filterType || 'lowpass';
  filter.frequency.setValueAtTime(options.filter ?? 1400, when);
  filter.Q.setValueAtTime(options.q ?? 0.8, when);
  osc.type = options.type || 'sine';
  osc.frequency.setValueAtTime(hz, when);
  if (options.slide) osc.frequency.exponentialRampToValueAtTime(hz * options.slide, when + duration * 0.7);
  osc.connect(filter);
  filter.connect(gain);
  osc.start(when);
  osc.stop(when + duration + 0.08);
}

function playNoise(ctx, noise, destination, when, duration, options = {}) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = envGain(ctx, destination, when, options.attack ?? 0.004, duration, options.gain ?? 0.025);
  source.buffer = noise;
  source.loop = true;
  filter.type = options.type || 'bandpass';
  filter.frequency.setValueAtTime(options.frequency ?? 1700, when);
  filter.Q.setValueAtTime(options.q ?? 5, when);
  source.connect(filter);
  filter.connect(gain);
  source.start(when);
  source.stop(when + duration + 0.08);
}

export function createSkyMusic() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return { supported: false, start() {}, pulse() {}, stop() {} };

  let ctx = null;
  let master = null;
  let delay = null;
  let feedback = null;
  let filter = null;
  let noise = null;
  let timer = 0;
  let step = 0;
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
    filter.type = 'lowpass';
    filter.frequency.value = 3600;
    feedback.gain.value = 0.24;
    delay.delayTime.value = 0.28;
    master.gain.value = 0.0;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);
    noise = makeNoiseBuffer(ctx);
    return true;
  }

  function scheduleStep() {
    if (!ctx || !started) return;
    const bpm = 74 + Math.min(16, currentRhythm * 2.4) + (currentState === 'wind' ? 8 : currentState === 'lightning' ? 12 : 0);
    const beat = 60 / bpm;
    const now = ctx.currentTime;
    const root = stateRoot(currentState);
    const localStep = step % 64;
    const chord = CHORDS[Math.floor(localStep / 16) % CHORDS.length];
    const chordRoot = root + chord[0];
    const brightness = currentState === 'aurora' || currentState === 'dawn' || currentState === 'murmur';
    const wet = currentState === 'rain' || currentState === 'murmur' || currentState === 'aurora';
    delay.delayTime.setTargetAtTime(wet ? beat * 0.75 : beat * 0.5, now, 0.05);
    feedback.gain.setTargetAtTime(wet ? 0.34 : 0.2, now, 0.08);
    filter.frequency.setTargetAtTime(brightness ? 5200 : 2600, now, 0.12);

    for (let i = 0; i < 5; i += 1) {
      const when = now + i * beat * 0.5;
      const idx = step + i;
      const phrase = Math.floor(idx / 16);
      const motifDegree = MOTIF[idx % MOTIF.length] + (phrase % 2 === 0 ? 0 : 2);
      if (idx % 2 === 0) {
        const note = scaleNote(root, motifDegree, 1 + (idx % 8 === 6 ? 1 : 0));
        playOsc(ctx, delay, when, midiToHz(note), beat * 0.92, {
          type: brightness ? 'triangle' : 'sine',
          gain: 0.028 + currentPulse * 0.018,
          filter: brightness ? 4200 : 2400,
        });
      }
      if (idx % 4 === 0) {
        const bass = chordRoot - 24 + (idx % 16 === 12 ? 7 : 0);
        playOsc(ctx, master, when, midiToHz(bass), beat * 1.6, {
          type: 'sine',
          gain: 0.045,
          attack: 0.025,
          filter: 620,
        });
      }
      if (idx % 8 === 0) {
        chord.forEach((offset, voice) => {
          playOsc(ctx, delay, when + voice * 0.015, midiToHz(root + offset + 12), beat * 2.8, {
            type: 'triangle',
            gain: 0.012,
            attack: 0.08 + voice * 0.018,
            filter: 1700 + voice * 520,
          });
        });
      }
      if (currentState === 'rain' && idx % 3 === 0) {
        playNoise(ctx, noise, delay, when, beat * 0.22, { frequency: 1800 + (idx % 5) * 260, gain: 0.012, q: 7 });
      }
      if (currentState === 'lightning' && idx % 7 === 0) {
        playOsc(ctx, delay, when, midiToHz(root + 31), beat * 0.18, { type: 'sawtooth', gain: 0.018, filter: 5200, slide: 0.72 });
      }
    }
    step += 5;
  }

  async function start(snapshot = {}) {
    if (!ensure()) return false;
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.42, ctx.currentTime, 0.35);
    if (!timer) {
      scheduleStep();
      timer = window.setInterval(scheduleStep, 1250);
    }
    return true;
  }

  function pulse(snapshot = {}) {
    currentState = snapshot.state || currentState;
    currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
    currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
    if (!ctx || !started) return;
    const root = stateRoot(currentState);
    const note = scaleNote(root, MOTIF[(step + Math.round(currentRhythm)) % MOTIF.length], 2);
    playOsc(ctx, delay, ctx.currentTime + 0.01, midiToHz(note), 0.6, { type: 'triangle', gain: 0.026, filter: 3600 });
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
    if (master && ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    started = false;
  }

  return { supported: true, start, pulse, stop };
}
