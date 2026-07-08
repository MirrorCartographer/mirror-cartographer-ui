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
    const localStep = step % 128;
    const phrase = Math.floor(localStep / 16);
    const section = FORM[phrase % FORM.length];
    const chord = CHORDS[Math.floor(localStep / 16) % CHORDS.length];
    const chordRoot = root + chord[0];
    const brightness = currentState === 'aurora' || currentState === 'dawn' || currentState === 'murmur';
    const wet = currentState === 'rain' || currentState === 'murmur' || currentState === 'aurora';
    const chorus = section === 'lift' || section === 'storm';
    const cadence = section === 'home';
    delay.delayTime.setTargetAtTime(wet ? beat * 0.75 : beat * 0.5, now, 0.05);
    feedback.gain.setTargetAtTime(wet || chorus ? 0.34 : 0.2, now, 0.08);
    filter.frequency.setTargetAtTime(brightness || chorus ? 5200 : 2600, now, 0.12);

    for (let i = 0; i < 5; i += 1) {
      const when = now + i * beat * 0.5;
      const idx = step + i;
      const localIdx = idx % 128;
      const phraseIdx = Math.floor(localIdx / 16);
      const sectionName = FORM[phraseIdx % FORM.length];
      const inPhrase = localIdx % 16;
      const lift = sectionName === 'lift' || sectionName === 'storm';
      const answering = sectionName === 'answer' || sectionName === 'home';
      const homeCadence = sectionName === 'home' && inPhrase >= 12;
      const contour = lift ? 4 : answering ? 1 : 0;
      const sourceMotif = answering ? ANSWER : MOTIF;
      const motifDegree = sourceMotif[inPhrase] + contour + (phraseIdx % 2 === 0 ? 0 : 2);

      if (idx % 2 === 0) {
        const note = homeCadence ? scaleNote(root, Math.max(0, 5 - (inPhrase - 12) * 2), 1) : scaleNote(root, motifDegree, 1 + (idx % 8 === 6 || lift ? 1 : 0));
        playOsc(ctx, delay, when, midiToHz(note), beat * (lift ? 1.12 : 0.92), {
          type: brightness || lift ? 'triangle' : 'sine',
          gain: 0.026 + currentPulse * 0.016 + (lift ? 0.01 : 0),
          filter: brightness || lift ? 4200 : 2400,
        });
      }

      if (answering && idx % 4 === 2) {
        const counter = scaleNote(root, ANSWER[(15 - inPhrase + ANSWER.length) % ANSWER.length] - 3, 1);
        playOsc(ctx, delay, when + beat * 0.18, midiToHz(counter), beat * 0.86, {
          type: 'sine',
          gain: 0.014 + currentPulse * 0.006,
          filter: 2100,
        });
      }

      if (idx % 4 === 0) {
        const walk = BASS_WALK[inPhrase] || 0;
        const bass = chordRoot - 24 + (lift ? 12 : 0) + (homeCadence ? 0 : walk);
        playOsc(ctx, master, when, midiToHz(bass), beat * (homeCadence ? 2.4 : 1.6), {
          type: 'sine',
          gain: 0.041 + (lift ? 0.008 : 0),
          attack: 0.025,
          filter: lift ? 760 : 620,
        });
      }

      if (idx % 8 === 0) {
        chord.forEach((offset, voice) => {
          const inversion = lift && voice > 1 ? 12 : 0;
          const release = cadence ? beat * 4.8 : beat * (lift ? 3.6 : 2.8);
          playOsc(ctx, delay, when + voice * 0.015, midiToHz(root + offset + 12 + inversion), release, {
            type: 'triangle',
            gain: 0.01 + (lift ? 0.005 : 0),
            attack: 0.08 + voice * 0.018,
            filter: 1700 + voice * 520 + (lift ? 900 : 0),
          });
        });
      }

      if (lift && idx % 8 === 6) {
        const sparkle = scaleNote(root, motifDegree + 7, 2);
        playOsc(ctx, delay, when + beat * 0.12, midiToHz(sparkle), beat * 0.42, {
          type: 'triangle',
          gain: 0.012,
          filter: 5600,
        });
      }

      if (currentState === 'rain' && idx % 3 === 0) {
        playNoise(ctx, noise, delay, when, beat * 0.22, { frequency: 1800 + (idx % 5) * 260, gain: 0.012, q: 7 });
      }
      if ((currentState === 'lightning' || sectionName === 'storm') && idx % 7 === 0) {
        playOsc(ctx, delay, when, midiToHz(root + 31), beat * 0.18, { type: 'sawtooth', gain: 0.014, filter: 5200, slide: 0.72 });
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
    const phrase = Math.floor((step % 128) / 16);
    const section = FORM[phrase % FORM.length];
    const motif = section === 'answer' || section === 'home' ? ANSWER : MOTIF;
    const note = scaleNote(root, motif[(step + Math.round(currentRhythm)) % motif.length] + (section === 'lift' ? 5 : 0), 2);
    playOsc(ctx, delay, ctx.currentTime + 0.01, midiToHz(note), 0.6, { type: 'triangle', gain: 0.026, filter: section === 'lift' ? 5200 : 3600 });
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = 0;
    if (master && ctx) master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    started = false;
  }

  return { supported: true, start, pulse, stop };
}
