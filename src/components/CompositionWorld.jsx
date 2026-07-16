import React, { useEffect, useMemo, useRef, useState } from 'react';
import RoomWorldValid from './RoomWorldValid';
import { clearCompositionEvidence, evidenceCount, exportCompositionEvidence, recordCompositionEvent } from '../engine/compositionEvidence';
import './CompositionWorld.css';

const STEPS = 8;
const TRACKS = [
  { name: 'Pulse', note: 110, shape: 'sine' },
  { name: 'Glass', note: 220, shape: 'triangle' },
  { name: 'Thread', note: 330, shape: 'sine' },
  { name: 'Spark', note: 660, shape: 'square' },
];
const KEY = 'fia-composition-world-v1';
const emptyGrid = () => TRACKS.map((_, track) => Array.from({ length: STEPS }, (_, step) => (step + track * 2) % (5 - Math.min(track, 2)) === 0));
const band = (value, low, high) => value < low ? 'low' : value > high ? 'high' : 'medium';

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && Array.isArray(saved.grid) ? saved : null;
  } catch {
    return null;
  }
}

function createVoice(context, destination, frequency, shape, intensity, pan) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = context.createStereoPanner ? context.createStereoPanner() : null;
  oscillator.type = shape;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035 + intensity * 0.08, context.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28 + intensity * 0.25);
  oscillator.connect(gain);
  if (panner) {
    panner.pan.value = pan;
    gain.connect(panner).connect(destination);
  } else {
    gain.connect(destination);
  }
  oscillator.start();
  oscillator.stop(context.currentTime + 0.65);
}

export default function CompositionWorld() {
  const saved = useMemo(loadState, []);
  const sessionStartedAt = useRef(Date.now());
  const [grid, setGrid] = useState(saved?.grid || emptyGrid);
  const [tempo, setTempo] = useState(saved?.tempo || 92);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState(saved?.energy || 0.42);
  const [roomOpen, setRoomOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState(() => evidenceCount());
  const [audioConsent, setAudioConsent] = useState(false);
  const [status, setStatus] = useState('sound is asleep');
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ grid, tempo, energy }));
  }, [grid, tempo, energy]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    audioRef.current?.context?.close?.();
  }, []);

  const remember = (type, delta) => {
    recordCompositionEvent(type, delta);
    setMemoryCount(evidenceCount());
  };

  const ensureAudio = async () => {
    if (!audioConsent) return null;
    if (!audioRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      master.gain.value = 0.55;
      master.connect(compressor).connect(context.destination);
      audioRef.current = { context, master };
    }
    await audioRef.current.context.resume();
    return audioRef.current;
  };

  const playStep = async (nextStep) => {
    const audio = await ensureAudio();
    if (!audio) return;
    TRACKS.forEach((track, trackIndex) => {
      if (!grid[trackIndex][nextStep]) return;
      const drift = 1 + ((nextStep - 3.5) * energy) / 36;
      createVoice(audio.context, audio.master, track.note * drift, track.shape, energy, (nextStep / (STEPS - 1)) * 2 - 1);
    });
    setStep(nextStep);
  };

  const stop = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setStatus('field paused');
    remember('playback_stop', { source: 'sequencer' });
  };

  const start = async () => {
    if (!audioConsent) {
      setStatus('wake sound first');
      return;
    }
    await ensureAudio();
    clearInterval(timerRef.current);
    setPlaying(true);
    setStatus('field sounding');
    remember('playback_start', { source: 'sequencer' });
    let cursor = step;
    await playStep(cursor);
    timerRef.current = setInterval(() => {
      cursor = (cursor + 1) % STEPS;
      playStep(cursor);
    }, 60000 / tempo / 2);
  };

  const toggle = (track, index) => {
    const enabled = !grid[track][index];
    setGrid((current) => current.map((row, rowIndex) => rowIndex === track ? row.map((value, stepIndex) => stepIndex === index ? !value : value) : row));
    setEnergy((value) => Math.min(1, value + 0.025));
    remember('step_toggle', { track, step: index, enabled });
  };

  const mutate = () => {
    let changedCells = 0;
    setGrid((current) => current.map((row, track) => row.map((value, index) => {
      const shouldFlip = Math.abs(Math.sin((index + 1) * (track + 2) + energy * 12)) > 0.66;
      if (shouldFlip) changedCells += 1;
      return shouldFlip ? !value : value;
    })));
    setEnergy((value) => (value * 1.37) % 1);
    remember('motif_mutate', { changedCells });
  };

  const clear = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setGrid(TRACKS.map(() => Array(STEPS).fill(false)));
    setStep(0);
    setEnergy(0.08);
    setStatus('field cleared');
    remember('score_clear', { source: 'sequencer' });
  };

  const grantAudio = async () => {
    setAudioConsent(true);
    remember('audio_consent', { enabled: true });
    setStatus('sound awake — press begin');
  };

  const exportEvidence = () => {
    const payload = exportCompositionEvidence(sessionStartedAt.current);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fia-composition-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMemoryCount(evidenceCount());
    setStatus('evidence exported by you');
  };

  const eraseEvidence = () => {
    clearCompositionEvidence();
    setMemoryCount(0);
    setStatus('interaction memory erased');
  };

  if (roomOpen) {
    return <div className="composition-room-shell"><button className="return-to-score" onClick={() => { setRoomOpen(false); remember('room_exit', { source: 'room_world' }); }}>← return to score</button><RoomWorldValid /></div>;
  }

  return <main className="composition-world" style={{ '--energy': energy }}>
    <div className="score-sky" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--i': index }} />)}</div>

    <header className="composition-header">
      <p>FOUNDATION INTELLIGENCE / COMPOSITION FIELD 02</p>
      <h1>Play what remembers.</h1>
      <span>The score stays on this device. Its memory is visible, erasable, and exported only when you choose.</span>
    </header>

    <section className="consent-strip" aria-label="Audio consent and status">
      <button className={audioConsent ? 'consented' : ''} onClick={grantAudio} disabled={audioConsent}>{audioConsent ? 'sound permission granted' : 'wake sound'}</button>
      <output aria-live="polite">{status}</output>
      <button onClick={() => setMemoryOpen((value) => !value)} aria-expanded={memoryOpen}>memory · {memoryCount}</button>
    </section>

    {memoryOpen && <section className="memory-drawer" aria-label="Local interaction memory">
      <div><strong>Local evidence ledger</strong><p>Stores control types, motif deltas, coarse session duration, errors, and accessibility modes. It stores no identity, microphone audio, raw text, or deleted content.</p></div>
      <div className="memory-actions"><button onClick={exportEvidence}>export evidence</button><button onClick={eraseEvidence}>erase evidence</button></div>
    </section>}

    <section className="sequencer" aria-label="Eight-step musical sequencer">
      <div className="track-labels" aria-hidden="true">{TRACKS.map((track) => <span key={track.name}>{track.name}</span>)}</div>
      <div className="score-grid">
        {grid.map((row, trackIndex) => row.map((active, index) => <button
          key={`${trackIndex}-${index}`}
          className={`${active ? 'active' : ''} ${playing && step === index ? 'current' : ''}`}
          aria-label={`${TRACKS[trackIndex].name}, step ${index + 1}, ${active ? 'on' : 'off'}`}
          aria-pressed={active}
          onClick={() => toggle(trackIndex, index)}
          style={{ '--track': trackIndex, '--step': index }}
        ><i /></button>))}
      </div>
    </section>

    <section className="composer-controls" aria-label="Composition controls">
      <button className="primary-control" onClick={playing ? stop : start}>{playing ? 'pause field' : 'begin field'}</button>
      <button onClick={mutate}>mutate motif</button>
      <button onClick={clear}>clear</button>
      <label>tempo <input type="range" min="54" max="168" value={tempo} onChange={(event) => { const next = Number(event.target.value); setTempo(next); remember('tempo_change', { tempoBand: band(next, 84, 132) }); }} /><output>{tempo}</output></label>
      <label>density <input type="range" min="0" max="1" step="0.01" value={energy} onChange={(event) => { const next = Number(event.target.value); setEnergy(next); remember('density_change', { densityBand: band(next, 0.33, 0.67) }); }} /><output>{Math.round(energy * 100)}</output></label>
    </section>

    <button className="room-door" onClick={() => { clearInterval(timerRef.current); setPlaying(false); setRoomOpen(true); remember('room_enter', { source: 'composition_world' }); }}>
      <span>enter the room beneath the score</span><i aria-hidden="true">✣</i>
    </button>

    <footer><span>saved locally on this device</span><span>audio begins only after consent</span><span>memory is visible and reversible</span></footer>
  </main>;
}
