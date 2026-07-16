import React, { useEffect, useMemo, useRef, useState } from 'react';
import './CompositionWorld.css';

const TRACKS = [
  { id: 'pulse', label: 'Pulse', note: 48, shape: 'square' },
  { id: 'body', label: 'Body', note: 55, shape: 'triangle' },
  { id: 'light', label: 'Light', note: 62, shape: 'sine' },
  { id: 'ghost', label: 'Ghost', note: 69, shape: 'sawtooth' },
];
const STEPS = 16;
const STORAGE_KEY = 'fia-composition-world-v1';
const emptyPattern = () => TRACKS.map(() => Array(STEPS).fill(false));
const midiToHz = (midi) => 440 * (2 ** ((midi - 69) / 12));

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.pattern?.length === TRACKS.length) return parsed;
  } catch {}
  return null;
}

function useCompositionAudio() {
  const contextRef = useRef(null);
  const masterRef = useRef(null);

  const wake = async () => {
    if (!contextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }
    if (contextRef.current.state === 'suspended') await contextRef.current.resume();
    return contextRef.current;
  };

  const voice = async (track, step, intensity = 0.7) => {
    const context = await wake();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = track.shape;
    oscillator.frequency.value = midiToHz(track.note + ((step % 4) * 2));
    filter.type = 'lowpass';
    filter.frequency.value = 900 + intensity * 2200;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14 * intensity, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22 + intensity * 0.18);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(masterRef.current);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  };

  const chord = async (root = 48) => {
    await Promise.all([0, 7, 12].map((offset, index) => voice({ shape: ['sine', 'triangle', 'sine'][index], note: root + offset }, index, 0.55)));
  };

  return { voice, chord, wake };
}

export default function CompositionWorld() {
  const saved = useMemo(loadState, []);
  const [pattern, setPattern] = useState(saved?.pattern || emptyPattern());
  const [tempo, setTempo] = useState(saved?.tempo || 92);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(saved?.mood || 'dusk');
  const [message, setMessage] = useState('Touch the field. Make a small world repeat.');
  const [events, setEvents] = useState(saved?.events || []);
  const timerRef = useRef(null);
  const audio = useCompositionAudio();

  const record = (type, detail = {}) => {
    setEvents((current) => [...current.slice(-199), { type, detail, at: new Date().toISOString() }]);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pattern, tempo, mood, events }));
  }, [pattern, tempo, mood, events]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!playing) return undefined;
    const interval = (60_000 / tempo) / 4;
    timerRef.current = setInterval(() => {
      setStep((current) => {
        const next = (current + 1) % STEPS;
        pattern.forEach((row, trackIndex) => {
          if (row[next]) audio.voice(TRACKS[trackIndex], next, 0.55 + trackIndex * 0.1);
        });
        return next;
      });
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [playing, tempo, pattern]);

  const toggleCell = (trackIndex, stepIndex) => {
    setPattern((current) => current.map((row, rowIndex) => rowIndex === trackIndex
      ? row.map((active, columnIndex) => columnIndex === stepIndex ? !active : active)
      : row));
    audio.voice(TRACKS[trackIndex], stepIndex, 0.8);
    record('cell-toggle', { track: TRACKS[trackIndex].id, step: stepIndex });
  };

  const mutate = () => {
    setPattern((current) => current.map((row, trackIndex) => row.map((active, index) => {
      const anchor = index % (trackIndex + 3) === 0;
      if (Math.random() < 0.14) return !active;
      return active || (anchor && Math.random() < 0.18);
    })));
    setMessage('The composition changed without forgetting itself.');
    record('mutate');
  };

  const clear = () => {
    setPattern(emptyPattern());
    setMessage('Silence is still part of the score.');
    record('clear');
  };

  const exportSession = () => {
    const payload = { schema: 'fia-composition-session/v1', exportedAt: new Date().toISOString(), tempo, mood, pattern, events };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fia-composition-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Your session left as an artifact you own.');
    record('export');
  };

  const togglePlaying = async () => {
    await audio.wake();
    setPlaying((value) => !value);
    record(playing ? 'pause' : 'play');
  };

  return (
    <main className={`composition-world mood-${mood}`}>
      <div className="composition-haze" aria-hidden="true" />
      <header className="composition-header">
        <div>
          <p className="eyebrow">FOUNDATION INTELLIGENCE / COMPOSITION WORLD 01</p>
          <h1>Build meaning like music.</h1>
          <p className="lede">A website that listens to structure: repetition, tension, silence, return.</p>
        </div>
        <button className={`play-orb ${playing ? 'is-playing' : ''}`} onClick={togglePlaying} aria-label={playing ? 'Pause composition' : 'Play composition'}>
          <span>{playing ? 'Ⅱ' : '▶'}</span>
        </button>
      </header>

      <section className="score-shell" aria-label="Interactive step sequencer">
        <div className="score-toolbar">
          <label>Tempo <input type="range" min="54" max="160" value={tempo} onChange={(event) => { setTempo(Number(event.target.value)); record('tempo', { value: Number(event.target.value) }); }} /> <strong>{tempo}</strong></label>
          <div className="mood-switch" role="group" aria-label="Composition mood">
            {['dusk', 'ember', 'glass'].map((name) => <button key={name} className={mood === name ? 'active' : ''} onClick={() => { setMood(name); audio.chord(name === 'dusk' ? 45 : name === 'ember' ? 50 : 57); record('mood', { name }); }}>{name}</button>)}
          </div>
        </div>

        <div className="score-grid">
          {TRACKS.map((track, trackIndex) => (
            <div className="track-row" key={track.id}>
              <span className="track-name">{track.label}</span>
              <div className="steps">
                {pattern[trackIndex].map((active, stepIndex) => (
                  <button
                    key={stepIndex}
                    className={`${active ? 'active' : ''} ${step === stepIndex && playing ? 'current' : ''}`}
                    aria-label={`${track.label}, beat ${stepIndex + 1}, ${active ? 'active' : 'inactive'}`}
                    aria-pressed={active}
                    onClick={() => toggleCell(trackIndex, stepIndex)}
                  ><i /></button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="composition-actions">
        <button onClick={mutate}>Mutate gently</button>
        <button onClick={clear}>Return to silence</button>
        <button onClick={exportSession}>Export the session</button>
      </section>

      <footer>
        <p>{message}</p>
        <span>{events.length} local interaction events · stored only in this browser until exported</span>
      </footer>
    </main>
  );
}
