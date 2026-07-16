import React, { useEffect, useMemo, useRef, useState } from 'react';
import RoomWorldValid from './RoomWorldValid';
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
  const [grid, setGrid] = useState(saved?.grid || emptyGrid);
  const [tempo, setTempo] = useState(saved?.tempo || 92);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState(saved?.energy || 0.42);
  const [roomOpen, setRoomOpen] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ grid, tempo, energy }));
  }, [grid, tempo, energy]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    audioRef.current?.context?.close?.();
  }, []);

  const ensureAudio = async () => {
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
  };

  const start = async () => {
    await ensureAudio();
    stop();
    setPlaying(true);
    let cursor = step;
    await playStep(cursor);
    timerRef.current = setInterval(() => {
      cursor = (cursor + 1) % STEPS;
      playStep(cursor);
    }, 60000 / tempo / 2);
  };

  const toggle = (track, index) => {
    setGrid((current) => current.map((row, rowIndex) => rowIndex === track ? row.map((value, stepIndex) => stepIndex === index ? !value : value) : row));
    setEnergy((value) => Math.min(1, value + 0.025));
  };

  const mutate = () => {
    setGrid((current) => current.map((row, track) => row.map((value, index) => {
      const wave = Math.sin((index + 1) * (track + 2) + energy * 12);
      return Math.abs(wave) > 0.66 ? !value : value;
    })));
    setEnergy((value) => (value * 1.37) % 1);
  };

  const clear = () => {
    stop();
    setGrid(TRACKS.map(() => Array(STEPS).fill(false)));
    setStep(0);
    setEnergy(0.08);
  };

  if (roomOpen) {
    return <div className="composition-room-shell"><button className="return-to-score" onClick={() => setRoomOpen(false)}>← return to score</button><RoomWorldValid /></div>;
  }

  return <main className="composition-world" style={{ '--energy': energy }}>
    <div className="score-sky" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ '--i': index }} />)}
    </div>

    <header className="composition-header">
      <p>FOUNDATION INTELLIGENCE / COMPOSITION FIELD 01</p>
      <h1>Play the architecture.</h1>
      <span>Every choice changes the score. Nothing begins until you touch it.</span>
    </header>

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
      <label>tempo <input type="range" min="54" max="168" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /><output>{tempo}</output></label>
      <label>density <input type="range" min="0" max="1" step="0.01" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /><output>{Math.round(energy * 100)}</output></label>
    </section>

    <button className="room-door" onClick={() => { stop(); setRoomOpen(true); }}>
      <span>enter the room beneath the score</span><i aria-hidden="true">✣</i>
    </button>

    <footer>
      <span>saved locally on this device</span>
      <span>audio is generated in your browser</span>
      <span>no autoplay</span>
    </footer>
  </main>;
}
