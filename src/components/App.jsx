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

function PortalCanvas({ capsule, mode, intensity, drift }) {
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
        const t = frame * 0.008 + i * 0.63 + drift;
        const x = w * (0.5 + Math.sin(t * 0.74) * 0.34);
        const y = h * (0.5 + Math.cos(t * 0.91) * 0.26);
        const rx = 28 + (weather.bloom * 0.55) + Math.sin(t) * 18;
        const ry = 42 + (weather.tide * 0.45) + Math.cos(t * 1.2) * 15;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.28);
        ctx.strokeStyle = `${colors[i % colors.length]}${mode === 'full' ? '66' : '42'}`;
        ctx.lineWidth = 0.7 + (weather.charge / 120);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const particles = mode === 'full' ? 90 : 42;
      for (let i = 0; i < particles; i += 1) {
        const base = i * 91.7;
        const speed = 0.0025 + weather.static / 52000;
        const angle = base + frame * speed * (i % 7 + 1) + drift;
        const orbit = 40 + ((i * 29) % Math.min(w, h)) * 0.48;
        const x = w / 2 + Math.cos(angle) * orbit + Math.sin(frame * 0.004 + i) * weather.static * 0.12;
        const y = h / 2 + Math.sin(angle * 1.17) * orbit * 0.68 + Math.cos(frame * 0.006 + i) * weather.tide * 0.09;
        const size = 0.9 + ((i % 5) * 0.5) + intensity * 0.02;
        ctx.fillStyle = `${colors[(i + frame) % colors.length]}${mode === 'full' ? 'cc' : '88'}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(Math.sin(frame * 0.004 + drift) * 0.18);
      const radius = Math.min(w, h) * (0.14 + weather.bloom / 900);
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
      ctx.lineWidth = 1.1;
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
  }, [capsule, mode, intensity, drift]);

  return <canvas className="portal-canvas" ref={canvasRef} aria-label={`Generative artwork for ${capsule?.title || 'portal signal'}`} />;
}

function useAudioEngine() {
  const audioRef = useRef(null);
  const nodesRef = useRef([]);
  const [playingId, setPlayingId] = useState(null);
  const [audioNote, setAudioNote] = useState('');

  const stop = () => {
    nodesRef.current.forEach((node) => {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    });
    nodesRef.current = [];
    setPlayingId(null);
  };

  const play = async (capsule, mutationIndex) => {
    try {
      stop();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        setAudioNote('audio unavailable in this browser');
        return;
      }
      const context = audioRef.current || new AudioContext();
      audioRef.current = context;
      if (context.state === 'suspended') await context.resume();

      const master = context.createGain();
      master.gain.value = 0.035;
      master.connect(context.destination);

      const delay = context.createDelay();
      delay.delayTime.value = 0.18 + capsule.weather.tide / 600;
      const feedback = context.createGain();
      feedback.gain.value = 0.16;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(master);

      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420 + capsule.weather.bloom * 24;
      filter.Q.value = 3 + capsule.weather.static / 25;
      filter.connect(delay);
      filter.connect(master);

      const base = 110 + capsule.weather.charge * 1.8 + mutationIndex * 9;
      const ratios = [1, 1.25, 1.5, 2, 2.5, 3].slice(0, capsule.weather.static > 70 ? 6 : 4);
      const now = context.currentTime;

      ratios.forEach((ratio, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = index % 3 === 0 ? 'sawtooth' : index % 3 === 1 ? 'triangle' : 'sine';
        osc.frequency.value = base * ratio;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(filter);
        const pulse = 0.012 + capsule.weather.bloom / 6000;
        for (let step = 0; step < 24; step += 1) {
          const t = now + step * (0.18 + capsule.weather.tide / 1400) + index * 0.014;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(pulse / (index + 1), t + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13 + capsule.weather.static / 2000);
        }
        osc.start(now);
        osc.stop(now + 5.2);
        nodesRef.current.push(osc, gain);
      });

      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11 + capsule.weather.tide / 900;
      lfoGain.gain.value = 130 + capsule.weather.static;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);
      lfo.stop(now + 5.2);
      nodesRef.current.push(lfo, lfoGain, filter, delay, feedback, master);

      setAudioNote('');
      setPlayingId(capsule.id);
      window.setTimeout(() => setPlayingId(null), 5300);
    } catch {
      stop();
      setAudioNote('audio blocked; tap again or try another browser');
    }
  };

  useEffect(() => stop, []);

  return { play, stop, playingId, audioNote };
}

function WeatherBar({ label, value }) {
  return (
    <div className="weather-bar">
      <div className="weather-label"><span>{label}</span><span>{value}</span></div>
      <div className="weather-track"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function CapsuleNode({ capsule, active, onSelect }) {
  const style = {
    '--a': capsule.palette[0],
    '--b': capsule.palette[1],
    '--c': capsule.palette[2]
  };
  return (
    <button className={`capsule-node ${active ? 'active' : ''}`} style={style} onClick={() => onSelect(capsule.id)}>
      <span className="node-orb" />
      <span className="node-copy">
        <strong>{capsule.title}</strong>
        <em>{capsule.type}</em>
      </span>
    </button>
  );
}

function ArtifactCard({ capsule, selected, onOpen }) {
  return (
    <button className={`artifact-card ${selected ? 'selected' : ''}`} onClick={() => onOpen(capsule.id)} style={{ '--a': capsule.palette[0], '--b': capsule.palette[1], '--c': capsule.palette[2] }}>
      <span className="artifact-glow" />
      <span className="artifact-type">{capsule.type}</span>
      <strong>{capsule.title}</strong>
      <span>{capsule.mood}</span>
    </button>
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
  const { play, stop, playingId, audioNote } = useAudioEngine();

  const selected = capsules.find((capsule) => capsule.id === selectedId) || capsules[0] || sanitizeCapsule(seedCapsules[0]);
  const portalWeather = weatherAverage(capsules);
  const nextIds = transitions[selected.id] || capsules.filter((capsule) => capsule.id !== selected.id).slice(0, 3).map((capsule) => capsule.id);
  const nextCapsules = nextIds.map((id) => capsules.find((capsule) => capsule.id === id)).filter(Boolean);
  const mutationWord = mutationWords[mutationIndex % mutationWords.length] || 'shift';

  useEffect(() => {
    const ok = safeSetStorage(STORAGE_KEY, { entered, mode, capsules, selectedId, mutationIndex, archive });
    setStorageWarning(ok ? '' : 'local save unavailable in this browser');
  }, [entered, mode, capsules, selectedId, mutationIndex, archive]);

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
    setCapsules(sanitizeCapsules(seedCapsules));
    setSelectedId(seedCapsules[0].id);
    setArchive([]);
    setMutationIndex(0);
    setActiveView('field');
  };

  if (!entered) {
    return (
      <main className="gate-screen">
        <div className="ambient-grid" />
        <section className="gate-card">
          <p className="eyebrow">mirror portal</p>
          <h1>our weather map for the things we make</h1>
          <p className="gate-line">artifacts, songs, fragments, videos, afterimages, guide-signals.</p>
          <button className="enter-button" onClick={() => setEntered(true)}>
            <span>enter</span>
          </button>
          <p className="quiet">no dashboard first. no product pitch. just the field.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`portal-shell ${mode}`}>
      <div className="noise-layer" />
      <header className="topline">
        <button className="ghost-button" onClick={() => setEntered(false)}>gate</button>
        <div className="status-line">
          <span>our vlog</span>
          <span>weather {portalWeather.charge}/{portalWeather.tide}/{portalWeather.static}/{portalWeather.bloom}</span>
          <span>{mode}</span>
        </div>
        <button className="ghost-button" onClick={() => setMode(mode === 'soft' ? 'full' : 'soft')}>{mode === 'soft' ? 'full mode' : 'soft mode'}</button>
      </header>

      {(storageWarning || audioNote) && <div className="system-note">{storageWarning || audioNote}</div>}

      <section className="hero-world">
        <div className="canvas-stage">
          <PortalCanvas capsule={selected} mode={mode} intensity={portalWeather.charge} drift={drift} />
          <div className="floating-title">
            <p className="eyebrow">now playing</p>
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
          <div className="action-row">
            <button className="primary-action" onClick={() => play(selected, mutationIndex)}>{playingId === selected.id ? 'playing' : 'play sound'}</button>
            <button className="secondary-action" onClick={stop}>hush</button>
          </div>
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
            <h3>touch an object. the weather changes.</h3>
          </div>
          <div className="node-map">
            {capsules.map((capsule) => <CapsuleNode key={capsule.id} capsule={capsule} active={capsule.id === selected.id} onSelect={setSelectedId} />)}
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
            {capsules.map((capsule) => <ArtifactCard key={capsule.id} capsule={capsule} selected={capsule.id === selected.id} onOpen={setSelectedId} />)}
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
            {archive.length === 0 && <p className="quiet">No aftermath saved yet. Mutate something, then save it.</p>}
            {archive.map((item) => (
              <article className="archive-item" key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>{item.title}</strong>
                <em>{item.mutation}</em>
                <p>{item.lyric}</p>
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
            <article><strong>Aftermath</strong><span>Mutations save locally and can export as JSON; storage failure degrades gracefully.</span></article>
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
