import React, { useEffect, useMemo, useRef, useState } from 'react';
import './GenerativeScoreGarden.css';
import { bandCount, eraseEvidence, exportEvidence, recordEvidence } from '../engine/scoreGardenEvidence';

const STORAGE_KEY = 'fia-score-garden-state-v1';
const FAMILIES = {
  moss: [0, 3, 7, 10],
  bell: [0, 5, 9, 12],
  ember: [0, 2, 7, 14]
};

function seededNotes(seed, growth) {
  const base = FAMILIES[seed.family];
  return Array.from({ length: growth + 2 }, (_, index) => {
    const step = base[(seed.id + index * 2) % base.length];
    return 48 + step + ((seed.id + index) % 3) * 12;
  });
}

export default function GenerativeScoreGarden() {
  const [seeds, setSeeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [family, setFamily] = useState('moss');
  const [audioReady, setAudioReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Plant a seed. Sound remains asleep until you wake it.');
  const audioRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds)); }, [seeds]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const score = useMemo(() => seeds.flatMap(seed => seededNotes(seed, seed.growth)), [seeds]);

  const wakeSound = async () => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    await audioRef.current.resume();
    setAudioReady(true);
    setStatus('Sound is awake.');
    recordEvidence({ type: 'audio_consent', audio_state: 'granted' });
  };

  const plant = () => {
    const next = { id: seeds.length ? Math.max(...seeds.map(s => s.id)) + 1 : 1, family, growth: 0 };
    setSeeds(current => [...current, next].slice(-8));
    setStatus(`${family} seed planted.`);
    recordEvidence({ type: 'seed_planted', seed_family: family, note_count_band: bandCount(score.length + 2), input_class: 'button' });
  };

  const grow = id => {
    setSeeds(current => current.map(seed => seed.id === id ? { ...seed, growth: Math.min(seed.growth + 1, 4) } : seed));
    const seed = seeds.find(item => item.id === id);
    if (seed) recordEvidence({ type: 'branch_grown', seed_family: seed.family, growth_band: String(Math.min(seed.growth + 1, 4)), input_class: 'button' });
  };

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlaying(false);
    setStatus('Score stopped.');
    recordEvidence({ type: 'score_stopped' });
  };

  const play = async () => {
    if (!audioReady || !audioRef.current) { setStatus('Wake sound before playing.'); return; }
    if (!score.length) { setStatus('Plant at least one seed.'); return; }
    stop();
    setPlaying(true);
    setStatus(`Playing ${score.length} notes.`);
    const ctx = audioRef.current;
    score.forEach((midi, index) => {
      const timer = setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index % 3 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
        osc.connect(gain).connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.45);
      }, index * 220);
      timers.current.push(timer);
    });
    timers.current.push(setTimeout(() => { setPlaying(false); setStatus('The garden is resting.'); }, score.length * 220 + 500));
    recordEvidence({ type: 'score_played', note_count_band: bandCount(score.length), audio_state: 'awake' });
  };

  const reset = () => {
    stop(); setSeeds([]); localStorage.removeItem(STORAGE_KEY); setStatus('Garden reset.');
    recordEvidence({ type: 'garden_reset' });
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(exportEvidence(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'score-garden-evidence.json'; link.click(); URL.revokeObjectURL(link.href);
    recordEvidence({ type: 'evidence_exported' });
  };

  return <main className="score-garden">
    <header>
      <p className="eyebrow">Composition Field 04</p>
      <h1>Generative Score Garden</h1>
      <p>Plant deterministic musical seeds, grow reversible branches, and replay the same garden offline.</p>
    </header>

    <section className="garden-controls" aria-label="Score controls">
      <button onClick={wakeSound} aria-pressed={audioReady}>{audioReady ? 'Sound awake' : 'Wake sound'}</button>
      <label>Seed family<select value={family} onChange={event => setFamily(event.target.value)}>{Object.keys(FAMILIES).map(name => <option key={name}>{name}</option>)}</select></label>
      <button onClick={plant}>Plant seed</button>
      <button onClick={playing ? stop : play}>{playing ? 'Stop score' : 'Play garden'}</button>
      <button onClick={reset}>Reset</button>
    </section>

    <section className="garden-bed" aria-label="Planted score">
      {seeds.length === 0 && <p className="empty">No seeds yet. The empty garden is silent.</p>}
      {seeds.map(seed => <article className={`seed seed-${seed.family}`} key={seed.id}>
        <div className="stem" style={{ '--growth': seed.growth }} aria-hidden="true">{Array.from({ length: seed.growth + 1 }, (_, i) => <span key={i}>✦</span>)}</div>
        <h2>{seed.family} {seed.id}</h2>
        <p>{seededNotes(seed, seed.growth).length} notes · growth {seed.growth}/4</p>
        <button onClick={() => grow(seed.id)} disabled={seed.growth >= 4}>Grow branch</button>
      </article>)}
    </section>

    <p className="status" role="status" aria-live="polite">{status}</p>
    <details><summary>Local interaction evidence</summary><p>Only coarse semantic actions are stored on this device. No identity, raw text, microphone input, pointer trails, or external analytics.</p><div className="evidence-actions"><button onClick={download}>Export evidence</button><button onClick={() => { eraseEvidence(); setStatus('Local evidence erased.'); }}>Erase evidence</button></div></details>
  </main>;
}
