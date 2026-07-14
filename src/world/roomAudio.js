const SCALE = [0,2,3,5,7,8,10,12];
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));

export function createRoomAudio() {
  let ctx = null;
  let master = null;
  let delay = null;
  let feedback = null;
  let active = false;
  let lastTime = 0;

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.16;
    delay = ctx.createDelay(1.4);
    delay.delayTime.value = 0.28;
    feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    delay.connect(feedback).connect(delay);
    master.connect(delay).connect(ctx.destination);
    master.connect(ctx.destination);
    return ctx;
  }

  function voice(room, layer, energy = 0.5, x = 0.5, y = 0.5) {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    active = true;
    const now = ctx.currentTime;
    if (now - lastTime < 0.035) return;
    lastTime = now;
    const degree = SCALE[(room.seed + layer.index + Math.floor(x * 7)) % SCALE.length];
    const midi = layer.harmonic + degree + Math.floor((1-y) * 12);
    const hz = 440 * 2 ** ((midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const types = ['sine','triangle','sawtooth'];
    osc.type = types[(room.seed + layer.index) % types.length];
    osc.frequency.setValueAtTime(hz, now);
    osc.detune.setValueAtTime((x-.5)*24, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700 + energy * 4200 + y * 1800, now);
    filter.Q.value = 2 + room.gravity * 1.2;
    pan.pan.value = clamp((x-.5)*1.6,-1,1);
    const duration = 0.22 + (1-energy)*0.8 + (layer.index % 5)*0.07;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035 + energy*0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter).connect(gain).connect(pan).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function chord(room, layer, energy = 0.5) {
    [0,3,7].forEach((offset, i) => setTimeout(() => voice(room, { ...layer, harmonic: layer.harmonic + offset }, energy, 0.28 + i*.22, 0.52), i*55));
  }

  function silence() {
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    active = false;
  }

  function wake() {
    ensure();
    master.gain.setTargetAtTime(0.16, ctx.currentTime, 0.06);
    active = true;
  }

  function dispose() { if (ctx) ctx.close(); ctx = null; }
  return { voice, chord, silence, wake, dispose, get active(){ return active; } };
}
