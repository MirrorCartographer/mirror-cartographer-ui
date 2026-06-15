import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mutationWords, seedCapsules, transitions } from '../data/creationFeed';

const STORAGE_KEY = 'mirror.portal.creation.weather.v1';
const DEFAULT_WEATHER = { charge: 55, tide: 55, static: 55, bloom: 55 };
const DEFAULT_PALETTE = ['#f0abfc', '#38bdf8', '#fde047', '#020617'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function safeGetStorage(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeRemoveStorage(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function sanitizeCapsule(capsule, index = 0) {
  if (!capsule || typeof capsule !== 'object') return null;
  const weather = capsule.weather && typeof capsule.weather === 'object' ? capsule.weather : DEFAULT_WEATHER;
  const palette = Array.isArray(capsule.palette) && capsule.palette.length >= 3 ? capsule.palette : DEFAULT_PALETTE;
  return {
    id: String(capsule.id || `capsule-${index}`),
    title: String(capsule.title || 'Untitled signal'),
    type: String(capsule.type || 'signal'),
    mood: String(capsule.mood || 'unresolved, alive'),
    weather: {
      charge: clamp(Number(weather.charge), 0, 100),
      tide: clamp(Number(weather.tide), 0, 100),
      static: clamp(Number(weather.static), 0, 100),
      bloom: clamp(Number(weather.bloom), 0, 100)
    },
    phrase: String(capsule.phrase || 'A signal entered the field.'),
    lyric: String(capsule.lyric || 'new signal / no cage / still forming'),
    palette,
    notes: String(capsule.notes || ''),
    localOnly: Boolean(capsule.localOnly)
  };
}

function sanitizeCapsules(value) {
  const source = Array.isArray(value) && value.length ? value : seedCapsules;
  const clean = source.map(sanitizeCapsule).filter(Boolean);
  return clean.length ? clean : seedCapsules.map(sanitizeCapsule).filter(Boolean);
}

function loadSavedState() {
  const saved = safeGetStorage(STORAGE_KEY);
  if (!saved || typeof saved !== 'object') return null;
  return {
    entered: Boolean(saved.entered),
    mode: saved.mode === 'full' ? 'full' : 'soft',
    capsules: sanitizeCapsules(saved.capsules),
    selectedId: typeof saved.selectedId === 'string' ? saved.selectedId : undefined,
    mutationIndex: Number.isFinite(Number(saved.mutationIndex)) ? Number(saved.mutationIndex) : 0,
    archive: Array.isArray(saved.archive) ? saved.archive.slice(0, 40) : []
  };
}

function weatherAverage(capsules) {
  const clean = sanitizeCapsules(capsules);
  const total = clean.reduce((acc, capsule) => {
    acc.charge += capsule.weather.charge;
    acc.tide += capsule.weather.tide;
    acc.static += capsule.weather.static;
    acc.bloom += capsule.weather.bloom;
    return acc;
  }, { charge: 0, tide: 0, static: 0, bloom: 0 });
  const count = Math.max(clean.length, 1);
  return {
    charge: Math.round(total.charge / count),
    tide: Math.round(total.tide / count),
    static: Math.round(total.static / count),
    bloom: Math.round(total.bloom / count)
  };
}

function soundSignature(weather) {
  const w = weather || DEFAULT_WEATHER;
  if (w.tide >= 85 && w.static >= 65) return 'ocean static radio';
  if (w.charge >= 88 && w.static >= 70) return 'glitter thunder engine';
  if (w.bloom >= 85 && w.charge < 75) return 'soft bloom choir';
  if (w.static >= 82) return 'feral mirror pulse';
  if (w.tide >= 80) return 'slow water antenna';
  return 'low mirror hum';
}

function PortalCanvas({ capsule, mode, intensity, drift, soundActive }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx || !capsule) return undefined;

    let raf = 0;
    let frame = 0;
    let alive = true;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect?.();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor((rect?.width || 720) * dpr));
      const height = Math.max(320, Math.floor((rect?.height || 520) * dpr));
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (!alive) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const colors = capsule.palette || DEFAULT_PALETTE;
      const weather = capsule.weather || DEFAULT_WEATHER;
      frame += 1;

      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      bg.addColorStop(0, `${colors[1]}33`);
      bg.addColorStop(0.38, `${colors[0]}18`);
      bg.addColorStop(1, '#02030a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const bands = mode === 'full' ? 22 : 13;
      for (let i = 0; i < bands; i += 1) {
        const t = frame * (soundActive ? 0.011 : 0.008) + i * 0.63 + drift;
        const x = w * (0.5 + Math.sin(t * 0.74) * 0.34);
        const y = h * (0.5 + Math.cos(t * 0.91) * 0.26);
        const rx = 28 + (weather.bloom * 0.55) + Math.sin(t) * 18;
        const ry = 42 + (weather.tide * 0.45) + Math.cos(t * 1.2) * 15;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.28);
        ctx.strokeStyle = `${colors[i % colors.length]}${soundActive ? '88' : mode === 'full' ? '66' : '42'}`;
        ctx.lineWidth = 0.7 + (weather.charge / 120) + (soundActive ? 0.7 : 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const particles = mode === 'full' ? 90 : 42;
      for (let i = 0; i < particles; i += 1) {
        const base = i * 91.7;
        const speed = 0.0025 + weather.static / 52000 + (soundActive ? 0.0016 : 0);
        const angle = base + frame * speed * (i % 7 + 1) + drift;
        const orbit = 40 + ((i * 29) % Math.min(w, h)) * 0.48;
        const x = w / 2 + Math.cos(angle) * orbit + Math.sin(frame * 0.004 + i) * weather.static * 0.12;
        const y = h / 2 + Math.sin(angle * 1.17) * orbit * 0.68 + Math.cos(frame * 0.006 + i) * weather.tide * 0.09;
        const size = 0.9 + ((i % 5) * 0.5) + intensity * 0.02 + (soundActive ? 0.9 : 0);
        ctx.fillStyle = `${colors[(i + frame) % colors.length]}${soundActive ? 'ee' : mode === 'full' ? 'cc' : '88'}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.sin(frame * 0.004 + drift) * 0.18);
      const radius = Math.min(w, h) * (0.14 + weather.bloom / 900 + (soundActive ? 0.025 : 0));
      const portal = ctx.createRadialGradient(0, 0, 4, 0, 0, radius * 1.8);
      portal.addColorStop(0, `${colors[2]}dd`);
      portal.addColorStop(0.25, `${colors[1]}88`);
      portal.addColorStop(0.58, `${colors[0]}44`);
      portal.addColorStop(1, 'transparent');
      ctx.fillStyle = portal;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.72, radius * 1.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${colors[2]}aa`;
      ctx.lineWidth = soundActive ? 2.1 : 1.1;
      ctx.stroke();
      ctx.restore();

      raf = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = window.requestAnimationFrame(draw);

    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [capsule, mode, intensity, drift, soundActive]);

  return <canvas className="portal-canvas" ref={canvasRef} aria-label={`Generative artwork for ${capsule?.title || 'portal signal'}`} />;
}

function createNoiseBuffer(context, seconds = 1.2) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.82 + white * 0.18;
    data[i] = previous;
  }
  return buffer;
}

function useMirrorSoundEngine() {
  const contextRef = useRef(null);
  const nodesRef = useRef([]);
  const timerRef = useRef(null);
  const [armed, setArmed] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [audioNote, setAudioNote] = useState('');

  const disconnectNode = (node) => {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  };

  const stop = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    nodesRef.current.forEach(disconnectNode);
    nodesRef.current = [];
    setPlayingId(null);
  };

  const ensureContext = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio unavailable in this browser.');
    const context = contextRef.current || new AudioContext();
    contextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    setArmed(true);
    return context;
  };

  const arm = async () => {
    try {
      const context = await ensureContext();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = 222;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.38);
      nodesRef.current.push(osc, gain);
      setAudioNote('sound layer armed — tap a capsule or sound the field');
      window.setTimeout(() => setAudioNote(''), 1500);
    } catch (error) {
      setAudioNote(error.message || 'audio blocked; tap again or try another browser');
    }
  };

  const playCapsule = async (capsule, mutationIndex, voice = 'portal') => {
    if (!capsule) return;
    try {
      stop();
      const context = await ensureContext();
      const weather = capsule.weather || DEFAULT_WEATHER;
      const now = context.currentTime;
      const duration = 7.5 + weather.tide / 90;
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 22;
      compressor.ratio.value = 9;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.25;
      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.06, now + 0.22);
      master.gain.linearRampToValueAtTime(0.052, now + duration - 0.7);
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      master.connect(compressor);
      compressor.connect(context.destination);

      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260 + weather.bloom * 24, now);
      filter.frequency.linearRampToValueAtTime(420 + weather.charge * 28, now + duration * 0.62);
      filter.Q.value = 1.2 + weather.static / 38;

      const delay = context.createDelay();
      delay.delayTime.value = 0.08 + weather.tide / 420;
      const feedback = context.createGain();
      feedback.gain.value = 0.08 + weather.static / 900;
      delay.connect(feedback);
      feedback.connect(delay);

      const wet = context.createGain();
      wet.gain.value = 0.32;
      filter.connect(master);
      filter.connect(delay);
      delay.connect(wet);
      wet.connect(master);

      const base = 82 + weather.charge * 1.55 + mutationIndex * 4.5;
      const voiceRatios = {
        portal: [1, 1.5, 2, 2.5],
        ocean: [0.5, 1, 1.333, 2],
        thunder: [0.5, 1, 1.25, 1.875, 2.5],
        moth: [1, 1.125, 1.5, 2.25]
      };
      const ratios = voiceRatios[voice] || voiceRatios.portal;
      const wave = voice === 'thunder' ? 'sawtooth' : voice === 'moth' ? 'triangle' : 'sine';

      ratios.forEach((ratio, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const pan = context.createStereoPanner ? context.createStereoPanner() : null;
        osc.type = index === 0 && voice !== 'ocean' ? wave : index % 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(base * ratio, now);
        osc.detune.setValueAtTime((index - 1.5) * (weather.static / 10), now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime((0.018 + weather.bloom / 5200) / (index + 1), now + 0.4 + index * 0.12);
        gain.gain.linearRampToValueAtTime((0.012 + weather.tide / 9000) / (index + 1), now + duration - 0.9);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        if (pan) {
          pan.pan.value = -0.38 + index * (0.76 / Math.max(ratios.length - 1, 1));
          gain.connect(pan);
          pan.connect(filter);
          nodesRef.current.push(pan);
        } else {
          gain.connect(filter);
        }
        osc.start(now);
        osc.stop(now + duration);
        nodesRef.current.push(osc, gain);
      });

      const pulseCount = voice === 'thunder' ? 18 : 24;
      const pulseInterval = 0.16 + weather.tide / 1500;
      for (let i = 0; i < pulseCount; i += 1) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const t = now + 0.35 + i * pulseInterval;
        osc.type = voice === 'thunder' ? 'square' : 'triangle';
        osc.frequency.value = base * (1 + ((i % 5) * 0.125));
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.006 + weather.charge / 15000, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + weather.static / 1800);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(t);
        osc.stop(t + 0.2);
        nodesRef.current.push(osc, gain);
      }

      const noise = context.createBufferSource();
      const noiseGain = context.createGain();
      const noiseFilter = context.createBiquadFilter();
      noise.buffer = createNoiseBuffer(context, 1.6);
      noise.loop = true;
      noiseFilter.type = voice === 'ocean' ? 'bandpass' : 'highpass';
      noiseFilter.frequency.value = voice === 'ocean' ? 680 + weather.tide * 6 : 1300 + weather.static * 16;
      noiseFilter.Q.value = voice === 'ocean' ? 0.8 : 3.4;
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.006 + weather.static / 9000, now + 0.5);
      noiseGain.gain.linearRampToValueAtTime(0.002 + weather.tide / 12000, now + duration - 0.5);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(filter);
      noise.start(now);
      noise.stop(now + duration);
      nodesRef.current.push(noise, noiseGain, noiseFilter, filter, delay, feedback, wet, master, compressor);

      setAudioNote(`${soundSignature(weather)} — ${capsule.title}`);
      setPlayingId(capsule.id);
      timerRef.current = window.setTimeout(() => {
        setPlayingId(null);
        setAudioNote('');
      }, Math.ceil(duration * 1000) + 100);
    } catch (error) {
      stop();
      setAudioNote(error.message || 'audio blocked; tap sound again');
    }
  };

  useEffect(() => () => {
    stop();
    if (contextRef.current?.state !== 'closed') {
      try { contextRef.current?.close?.(); } catch {}
    }
  }, []);

  return { armed, arm, playCapsule, stop, playingId, audioNote };
}

function WeatherBar({ label, value }) {
  return (
    <div className="weather-bar">
      <div className="weather-label"><span>{label}</span><span>{value}</span></div>
      <div className="weather-track"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function CapsuleNode({ capsule, active, onSelect, onSound, sounding }) {
  const style = {
    '--a': capsule.palette[0],
    '--b': capsule.palette[1],
    '--c': capsule.palette[2]
  };
  return (
    <article className={`capsule-node ${active ? 'active' : ''} ${sounding ? 'sounding' : ''}`} style={style}>
      <button className="node-main" onClick={() => onSelect(capsule.id)}>
        <span className="node-orb" />
        <span className="node-copy">
          <strong>{capsule.title}</strong>
          <em>{capsule.type}</em>
          <small>{soundSignature(capsule.weather)}</small>
        </span>
      </button>
      <button className="node-sound" onClick={() => onSound(capsule)} aria-label={`Play sound for ${capsule.title}`}>
        {sounding ? 'humming' : 'sound'}
      </button>
    </article>
  );
}

function ArtifactCard({ capsule, selected, onOpen, onSound, sounding }) {
  return (
    <article className={`artifact-card ${selected ? 'selected' : ''} ${sounding ? 'sounding' : ''}`} style={{ '--a': capsule.palette[0], '--b': capsule.palette[1], '--c': capsule.palette[2] }}>
      <button className="artifact-open" onClick={() => onOpen(capsule.id)}>
        <span className="artifact-glow" />
        <span className="artifact-type">{capsule.type}</span>
        <strong>{capsule.title}</strong>
        <span>{capsule.mood}</span>
      </button>
      <button className="node-sound artifact-sound" onClick={() => onSound(capsule)}>
        {sounding ? 'humming' : 'sound'}
      </button>
    </article>
  );
}

function SoundConsole({ selected, portalWeather, armed, playingId, audioNote, onArm, onSound, onStop, voice, setVoice }) {
  const signature = soundSignature(selected?.weather);
  return (
    <section className="sound-console" aria-label="Mirror Cartographer sound layer">
      <div>
        <p className="eyebrow">sound layer</p>
        <h3>{armed ? signature : 'silent until touched'}</h3>
        <p className="quiet">Sound is opt-in. It maps capsule weather into pulse, tide, static, bloom, and a short living hum.</p>
      </div>
      <div className="sound-readout">
        <span>charge {selected.weather.charge}</span>
        <span>tide {selected.weather.tide}</span>
        <span>static {selected.weather.static}</span>
        <span>bloom {selected.weather.bloom}</span>
      </div>
      <label className="voice-picker">
        <span>voice</span>
        <select value={voice} onChange={(event) => setVoice(event.target.value)}>
          <option value="portal">portal glass</option>
          <option value="ocean">ocean static</option>
          <option value="thunder">glitter thunder</option>
          <option value="moth">lyr moth</option>
        </select>
      </label>
      <div className="action-row">
        <button className="primary-action" onClick={armed ? onSound : onArm}>
          {armed ? (playingId === selected.id ? 'field humming' : 'sound the field') : 'wake sound'}
        </button>
        <button className="secondary-action" onClick={onStop}>hush</button>
      </div>
      <p className="sound-status">{audioNote || `portal weather ${portalWeather.charge}/${portalWeather.tide}/${portalWeather.static}/${portalWeather.bloom}`}</p>
    </section>
  );
}

function DropZone({ onCreate }) {
  const [draft, setDraft] = useState({ title: '', type: 'signal drop', note: '', fileName: '', fileKind: '' });
  const [preview, setPreview] = useState(null);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview({ url, type: file.type || '', name: file.name });
    setDraft((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      fileKind: file.type || 'unknown'
    }));
  };

  const create = () => {
    const title = draft.title.trim() || 'Untitled signal';
    onCreate(sanitizeCapsule({
      id: `user-${Date.now()}`,
      title,
      type: draft.type || 'signal drop',
      mood: 'new, unresolved, alive',
      weather: DEFAULT_WEATHER,
      phrase: draft.note || 'A new artifact entered the weather.',
      lyric: 'new signal / no cage / still forming',
      palette: DEFAULT_PALETTE,
      notes: draft.fileName ? `${draft.note}\nAttached locally: ${draft.fileName} (${draft.fileKind})` : draft.note,
      localOnly: true
    }));
    setDraft({ title: '', type: 'signal drop', note: '', fileName: '', fileKind: '' });
    setPreview(null);
  };

  const previewType = preview?.type || '';

  return (
    <section className="drop-zone">
      <div>
        <p className="eyebrow">drop a signal</p>
        <h3>Bring in image, audio, video, lyrics, or debris.</h3>
        <p className="quiet">Files stay in your browser session. The saved capsule records the title, note, and local file name; repo-connected uploads can become permanent artifact storage later.</p>
      </div>
      <label className="file-drop">
        <input type="file" accept="image/*,audio/*,video/*,.txt,.md" onChange={handleFile} />
        <span>{preview ? preview.name : 'choose a file'}</span>
      </label>
      {preview && (
        <div className="preview-box">
          {previewType.startsWith('image/') && <img src={preview.url} alt="Selected signal preview" />}
          {previewType.startsWith('audio/') && <audio controls src={preview.url} />}
          {previewType.startsWith('video/') && <video controls src={preview.url} />}
          {!previewType.startsWith('image/') && !previewType.startsWith('audio/') && !previewType.startsWith('video/') && <p>{preview.name}</p>}
        </div>
      )}
      <input className="field-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="name the artifact" />
      <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="what is the weather around it?" />
      <button className="primary-action" onClick={create}>add to the portal</button>
    </section>
  );
}

function SoundLayerStyles() {
  return (
    <style>{`
      .sound-console {
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 28px;
        padding: 18px;
        background:
          radial-gradient(circle at 16% 8%, rgba(103,232,249,0.18), transparent 34%),
          radial-gradient(circle at 85% 90%, rgba(236,72,153,0.14), transparent 36%),
          rgba(255,255,255,0.045);
        box-shadow: inset 0 0 42px rgba(255,255,255,0.035);
        display: grid;
        gap: 14px;
      }

      .sound-console h3 {
        margin: 8px 0 6px;
        font-size: clamp(1.6rem, 3vw, 2.55rem);
        line-height: 0.95;
        letter-spacing: -0.06em;
      }

      .sound-readout {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .sound-readout span,
      .sound-status,
      .node-copy small {
        color: var(--dim);
        font-size: 0.74rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .sound-readout span {
        padding: 9px 10px;
        border: 1px solid rgba(255,255,255,0.11);
        border-radius: 999px;
        background: rgba(0,0,0,0.2);
      }

      .voice-picker {
        display: grid;
        gap: 8px;
      }

      .voice-picker span {
        color: var(--dim);
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .voice-picker select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(0,0,0,0.28);
        color: var(--ink);
        padding: 11px 12px;
      }

      .capsule-node,
      .artifact-card {
        display: grid;
        align-content: stretch;
      }

      .capsule-node.sounding,
      .artifact-card.sounding {
        border-color: rgba(103,232,249,0.72);
        box-shadow: 0 0 42px color-mix(in srgb, var(--b), transparent 78%), inset 0 0 26px rgba(255,255,255,0.04);
      }

      .node-main,
      .artifact-open {
        all: unset;
        cursor: pointer;
        display: block;
        min-height: 100%;
      }

      .artifact-open {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 10px;
        flex: 1;
      }

      .node-sound {
        position: relative;
        z-index: 2;
        justify-self: start;
        align-self: end;
        margin-top: 12px;
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 999px;
        padding: 7px 10px;
        background: rgba(2,3,10,0.42);
        color: var(--ink);
        cursor: pointer;
        font-size: 0.72rem;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }

      .artifact-sound {
        position: absolute;
        left: 18px;
        top: 18px;
        margin: 0;
      }

      .sound-status {
        margin: 0;
      }

      .system-note {
        max-width: 1480px;
        margin: 0 auto 14px;
        border: 1px solid rgba(253,230,138,0.28);
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(253,230,138,0.08);
        color: var(--gold);
      }

      @supports not (background: color-mix(in srgb, red, transparent 50%)) {
        .capsule-node.sounding,
        .artifact-card.sounding {
          box-shadow: 0 0 38px rgba(103,232,249,0.2);
        }
      }
    `}</style>
  );
}

function App() {
  const initial = useMemo(() => loadSavedState(), []);
  const initialCapsules = useMemo(() => sanitizeCapsules(initial?.capsules), [initial]);
  const [entered, setEntered] = useState(() => initial?.entered || false);
  const [mode, setMode] = useState(() => initial?.mode || 'soft');
  const [capsules, setCapsules] = useState(() => initialCapsules);
  const [selectedId, setSelectedId] = useState(() => initial?.selectedId || initialCapsules[0]?.id || seedCapsules[0].id);
  const [mutationIndex, setMutationIndex] = useState(() => initial?.mutationIndex || 0);
  const [archive, setArchive] = useState(() => initial?.archive || []);
  const [drift, setDrift] = useState(0);
  const [activeView, setActiveView] = useState('field');
  const [storageWarning, setStorageWarning] = useState('');
  const [voice, setVoice] = useState('portal');
  const sound = useMirrorSoundEngine();

  const selected = capsules.find((capsule) => capsule.id === selectedId) || capsules[0] || sanitizeCapsule(seedCapsules[0]);
  const portalWeather = weatherAverage(capsules);
  const nextIds = transitions[selected.id] || capsules.filter((capsule) => capsule.id !== selected.id).slice(0, 3).map((capsule) => capsule.id);
  const nextCapsules = nextIds.map((id) => capsules.find((capsule) => capsule.id === id)).filter(Boolean);
  const mutationWord = mutationWords[mutationIndex % mutationWords.length] || 'shift';

  useEffect(() => {
    const ok = safeSetStorage(STORAGE_KEY, { entered, mode, capsules, selectedId, mutationIndex, archive });
    setStorageWarning(ok ? '' : 'local save unavailable in this browser');
  }, [entered, mode, capsules, selectedId, mutationIndex, archive]);

  const playCapsule = (capsule = selected) => {
    setSelectedId(capsule.id);
    setDrift((value) => value + 0.21);
    sound.playCapsule(capsule, mutationIndex, voice);
  };

  const mutate = () => {
    setMutationIndex((index) => index + 1);
    setDrift((value) => value + 0.77);
    setCapsules((current) => current.map((capsule) => {
      if (capsule.id !== selected.id) return capsule;
      const shift = mutationIndex + 1;
      return {
        ...capsule,
        weather: {
          charge: clamp(capsule.weather.charge + ((shift % 3) - 1) * 7 + 3, 5, 99),
          tide: clamp(capsule.weather.tide + ((shift % 4) - 2) * 5 + 2, 5, 99),
          static: clamp(capsule.weather.static + ((shift % 5) - 2) * 6, 5, 99),
          bloom: clamp(capsule.weather.bloom + ((shift % 6) - 3) * 4 + 4, 5, 99)
        }
      };
    }));
  };

  const followSignal = () => {
    const pool = nextCapsules.length ? nextCapsules : capsules;
    if (!pool.length) return;
    const next = pool[(mutationIndex + selected.weather.static + archive.length) % pool.length];
    setSelectedId(next.id);
    setActiveView('field');
    setDrift((value) => value + 0.41);
  };

  const saveAftermath = () => {
    const entry = {
      id: `aftermath-${Date.now()}`,
      title: selected.title,
      mutation: mutationWord,
      phrase: selected.phrase,
      lyric: selected.lyric,
      weather: selected.weather,
      sound: soundSignature(selected.weather),
      createdAt: new Date().toISOString()
    };
    setArchive((items) => [entry, ...items].slice(0, 40));
    setActiveView('aftermath');
  };

  const exportPortal = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        concept: 'our vlog / our weather map / our playable art portal',
        soundLayer: {
          status: 'opt-in Web Audio capsule sonification',
          voices: ['portal', 'ocean', 'thunder', 'moth'],
          maps: ['charge -> pitch/pulse force', 'tide -> delay/drift', 'static -> noise/filter texture', 'bloom -> harmony/attack softness']
        },
        capsules,
        archive
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mirror-portal-weather-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setStorageWarning('export blocked by browser permissions');
    }
  };

  const addCapsule = (capsule) => {
    if (!capsule) return;
    setCapsules((current) => [capsule, ...sanitizeCapsules(current)]);
    setSelectedId(capsule.id);
    setActiveView('field');
  };

  const resetLocalField = () => {
    safeRemoveStorage(STORAGE_KEY);
    sound.stop();
    setCapsules(sanitizeCapsules(seedCapsules));
    setSelectedId(seedCapsules[0].id);
    setArchive([]);
    setMutationIndex(0);
    setActiveView('field');
  };

  if (!entered) {
    return (
      <main className="gate-screen">
        <SoundLayerStyles />
        <div className="ambient-grid" />
        <section className="gate-card">
          <p className="eyebrow">mirror portal</p>
          <h1>our weather map for the things we make</h1>
          <p className="gate-line">artifacts, songs, fragments, videos, afterimages, guide-signals.</p>
          <button className="enter-button" onClick={() => setEntered(true)}>
            <span>enter</span>
          </button>
          <p className="quiet">sound stays silent until you wake it. no autoplay. no jump scare. just the field.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`portal-shell ${mode}`}>
      <SoundLayerStyles />
      <div className="noise-layer" />
      <header className="topline">
        <button className="ghost-button" onClick={() => setEntered(false)}>gate</button>
        <div className="status-line">
          <span>our vlog</span>
          <span>weather {portalWeather.charge}/{portalWeather.tide}/{portalWeather.static}/{portalWeather.bloom}</span>
          <span>{sound.armed ? 'sound armed' : 'silent'}</span>
          <span>{mode}</span>
        </div>
        <button className="ghost-button" onClick={() => setMode(mode === 'soft' ? 'full' : 'soft')}>{mode === 'soft' ? 'full mode' : 'soft mode'}</button>
      </header>

      {(storageWarning || sound.audioNote) && <div className="system-note">{storageWarning || sound.audioNote}</div>}

      <section className="hero-world">
        <div className="canvas-stage">
          <PortalCanvas capsule={selected} mode={mode} intensity={portalWeather.charge} drift={drift} soundActive={sound.playingId === selected.id} />
          <div className="floating-title">
            <p className="eyebrow">{sound.playingId === selected.id ? 'now sounding' : 'now playing'}</p>
            <h2>{selected.title}</h2>
            <p>{selected.phrase}</p>
          </div>
        </div>
        <aside className="control-oracle">
          <p className="eyebrow">Lyr says</p>
          <blockquote>{selected.lyric}</blockquote>
          <div className="weather-panel">
            <WeatherBar label="charge" value={selected.weather.charge} />
            <WeatherBar label="tide" value={selected.weather.tide} />
            <WeatherBar label="static" value={selected.weather.static} />
            <WeatherBar label="bloom" value={selected.weather.bloom} />
          </div>
          <SoundConsole
            selected={selected}
            portalWeather={portalWeather}
            armed={sound.armed}
            playingId={sound.playingId}
            audioNote={sound.audioNote}
            onArm={sound.arm}
            onSound={() => playCapsule(selected)}
            onStop={sound.stop}
            voice={voice}
            setVoice={setVoice}
          />
          <div className="action-row">
            <button className="secondary-action" onClick={mutate}>mutate: {mutationWord}</button>
            <button className="secondary-action" onClick={followSignal}>follow signal</button>
          </div>
          <button className="save-action" onClick={saveAftermath}>save aftermath</button>
        </aside>
      </section>

      <nav className="world-tabs" aria-label="Portal layers">
        {['field', 'artifacts', 'drop', 'aftermath', 'engine'].map((view) => (
          <button key={view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>{view}</button>
        ))}
      </nav>

      {activeView === 'field' && (
        <section className="map-layer">
          <div className="section-heading">
            <p className="eyebrow">signal field</p>
            <h3>touch an object. the weather changes. sound gives it a body.</h3>
          </div>
          <div className="node-map">
            {capsules.map((capsule) => (
              <CapsuleNode
                key={capsule.id}
                capsule={capsule}
                active={capsule.id === selected.id}
                sounding={sound.playingId === capsule.id}
                onSelect={setSelectedId}
                onSound={playCapsule}
              />
            ))}
          </div>
        </section>
      )}

      {activeView === 'artifacts' && (
        <section className="artifact-layer">
          <div className="section-heading">
            <p className="eyebrow">made / imagined / playable</p>
            <h3>gallery of generated creation capsules.</h3>
          </div>
          <div className="artifact-grid">
            {capsules.map((capsule) => (
              <ArtifactCard
                key={capsule.id}
                capsule={capsule}
                selected={capsule.id === selected.id}
                sounding={sound.playingId === capsule.id}
                onOpen={setSelectedId}
                onSound={playCapsule}
              />
            ))}
          </div>
        </section>
      )}

      {activeView === 'drop' && <DropZone onCreate={addCapsule} />}

      {activeView === 'aftermath' && (
        <section className="aftermath-layer">
          <div className="section-heading">
            <p className="eyebrow">aftermath archive</p>
            <h3>what the portal kept after you touched it.</h3>
          </div>
          <div className="archive-list">
            {archive.length === 0 && <p className="quiet">No aftermath saved yet. Mutate something, sound it, then save it.</p>}
            {archive.map((item) => (
              <article className="archive-item" key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>{item.title}</strong>
                <em>{item.mutation}</em>
                <p>{item.sound ? `${item.sound} — ${item.lyric}` : item.lyric}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeView === 'engine' && (
        <section className="engine-layer">
          <div className="section-heading">
            <p className="eyebrow">under the floorboards</p>
            <h3>the connected architecture.</h3>
          </div>
          <div className="engine-grid">
            <article><strong>Creation feed</strong><span>New songs, prompts, art rooms, and animation concepts enter through src/data/creationFeed.js.</span></article>
            <article><strong>Living gallery</strong><span>GitHub stores the portal. Vercel rebuilds when files change.</span></article>
            <article><strong>Weather state</strong><span>Each artifact carries charge, tide, static, and bloom. Bad saved data is sanitized.</span></article>
            <article><strong>Sound layer</strong><span>Web Audio maps charge to pulse, tide to delay, static to noise, and bloom to harmonic softness. It stays silent until user activation.</span></article>
          </div>
          <div className="action-row wide">
            <button className="secondary-action" onClick={exportPortal}>export portal weather</button>
            <button className="secondary-action" onClick={resetLocalField}>reset local field</button>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
