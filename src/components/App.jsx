import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'mirror.portal.creation.weather.v1';

const seedCapsules = [
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

const transitions = {
  'afterimage-orchard': ['ocean-terminal', 'lyr-moth', 'signal-funeral'],
  'static-carnival': ['velvet-faultline', 'neon-kitchen-ghost', 'glass-animal-map'],
  'ocean-terminal': ['afterimage-orchard', 'signal-funeral', 'lyr-moth'],
  'lyr-moth': ['static-carnival', 'afterimage-orchard', 'glass-animal-map'],
  'velvet-faultline': ['static-carnival', 'signal-funeral', 'ocean-terminal'],
  'signal-funeral': ['afterimage-orchard', 'velvet-faultline', 'ocean-terminal'],
  'glass-animal-map': ['lyr-moth', 'static-carnival', 'neon-kitchen-ghost'],
  'neon-kitchen-ghost': ['static-carnival', 'glass-animal-map', 'velvet-faultline']
};

const mutationWords = ['bloom', 'fracture', 'drift', 'ignite', 'haunt', 'clarify', 'flood', 'invert'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function weatherAverage(capsules) {
  const total = capsules.reduce((acc, capsule) => {
    acc.charge += capsule.weather.charge;
    acc.tide += capsule.weather.tide;
    acc.static += capsule.weather.static;
    acc.bloom += capsule.weather.bloom;
    return acc;
  }, { charge: 0, tide: 0, static: 0, bloom: 0 });
  const count = Math.max(capsules.length, 1);
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
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(320, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const colors = capsule.palette;
      const weather = capsule.weather;
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

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [capsule, mode, intensity, drift]);

  return <canvas className="portal-canvas" ref={canvasRef} aria-label={`Generative artwork for ${capsule.title}`} />;
}

function useAudioEngine() {
  const audioRef = useRef(null);
  const nodesRef = useRef([]);
  const [playingId, setPlayingId] = useState(null);

  const stop = () => {
    nodesRef.current.forEach((node) => {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    });
    nodesRef.current = [];
    setPlayingId(null);
  };

  const play = async (capsule, mutationIndex) => {
    stop();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
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

    ratios.forEach((ratio, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = index % 3 === 0 ? 'sawtooth' : index % 3 === 1 ? 'triangle' : 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(filter);
      const now = context.currentTime;
      const pulse = 0.012 + capsule.weather.bloom / 6000;
      for (let step = 0; step < 24; step += 1) {
        const t = now + step * (0.18 + capsule.weather.tide / 1400) + index * 0.014;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(pulse / (index + 1), t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13 + capsule.weather.static / 2000);
      }
      osc.start();
      osc.stop(context.currentTime + 5.2);
      nodesRef.current.push(osc, gain);
    });

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.11 + capsule.weather.tide / 900;
    lfoGain.gain.value = 130 + capsule.weather.static;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    lfo.stop(context.currentTime + 5.2);
    nodesRef.current.push(lfo, lfoGain, filter, delay, feedback, master);

    setPlayingId(capsule.id);
    window.setTimeout(() => setPlayingId(null), 5300);
  };

  useEffect(() => stop, []);

  return { play, stop, playingId };
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
    '--c': capsule.palette[2],
    '--charge': capsule.weather.charge
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

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview({ url, type: file.type, name: file.name });
    setDraft((current) => ({
      ...current,
      title: current.title || file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      fileKind: file.type || 'unknown'
    }));
  };

  const create = () => {
    const title = draft.title.trim() || 'Untitled signal';
    const id = `user-${Date.now()}`;
    onCreate({
      id,
      title,
      type: draft.type || 'signal drop',
      mood: 'new, unresolved, alive',
      weather: { charge: 55, tide: 55, static: 55, bloom: 55 },
      phrase: draft.note || 'A new artifact entered the weather.',
      lyric: 'new signal / no cage / still forming',
      palette: ['#f0abfc', '#38bdf8', '#fde047', '#020617'],
      notes: draft.fileName ? `${draft.note}\nAttached locally: ${draft.fileName} (${draft.fileKind})` : draft.note,
      localOnly: true
    });
    setDraft({ title: '', type: 'signal drop', note: '', fileName: '', fileKind: '' });
    setPreview(null);
  };

  return (
    <section className="drop-zone">
      <div>
        <p className="eyebrow">drop a signal</p>
        <h3>Bring in image, audio, video, lyrics, or debris.</h3>
        <p className="quiet">Files stay in your browser session. The saved capsule records the title, note, and local file name; future repo-connected uploads can turn this into permanent artifact storage.</p>
      </div>
      <label className="file-drop">
        <input type="file" accept="image/*,audio/*,video/*,.txt,.md" onChange={handleFile} />
        <span>{preview ? preview.name : 'choose a file'}</span>
      </label>
      {preview && (
        <div className="preview-box">
          {preview.type.startsWith('image/') && <img src={preview.url} alt="Selected signal preview" />}
          {preview.type.startsWith('audio/') && <audio controls src={preview.url} />}
          {preview.type.startsWith('video/') && <video controls src={preview.url} />}
          {!preview.type.startsWith('image/') && !preview.type.startsWith('audio/') && !preview.type.startsWith('video/') && <p>{preview.name}</p>}
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
  const [entered, setEntered] = useState(() => initial?.entered || false);
  const [mode, setMode] = useState(() => initial?.mode || 'soft');
  const [capsules, setCapsules] = useState(() => initial?.capsules || seedCapsules);
  const [selectedId, setSelectedId] = useState(() => initial?.selectedId || seedCapsules[0].id);
  const [mutationIndex, setMutationIndex] = useState(() => initial?.mutationIndex || 0);
  const [archive, setArchive] = useState(() => initial?.archive || []);
  const [drift, setDrift] = useState(0);
  const [activeView, setActiveView] = useState('field');
  const { play, stop, playingId } = useAudioEngine();

  const selected = capsules.find((capsule) => capsule.id === selectedId) || capsules[0];
  const portalWeather = weatherAverage(capsules);
  const nextIds = transitions[selected.id] || capsules.filter((capsule) => capsule.id !== selected.id).slice(0, 3).map((capsule) => capsule.id);
  const nextCapsules = nextIds.map((id) => capsules.find((capsule) => capsule.id === id)).filter(Boolean);
  const mutationWord = mutationWords[mutationIndex % mutationWords.length];

  useEffect(() => {
    const state = { entered, mode, capsules, selectedId, mutationIndex, archive };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  };

  const addCapsule = (capsule) => {
    setCapsules((current) => [capsule, ...current]);
    setSelectedId(capsule.id);
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
            <article><strong>Creation engine</strong><span>Chat becomes the making room: songs, lyrics, prompts, animations, capsules.</span></article>
            <article><strong>Living gallery</strong><span>GitHub repo stores the portal. Netlify/Vercel can rebuild when files change.</span></article>
            <article><strong>Weather state</strong><span>Each artifact carries charge, tide, static, and bloom. The map averages them into atmosphere.</span></article>
            <article><strong>Aftermath</strong><span>Mutations become saved entries in local browser storage and can export as JSON.</span></article>
          </div>
          <div className="action-row wide">
            <button className="secondary-action" onClick={exportPortal}>export portal weather</button>
            <button className="secondary-action" onClick={() => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }}>reset local field</button>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;