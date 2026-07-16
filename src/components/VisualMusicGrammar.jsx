import React, { useMemo, useRef, useState } from 'react';
import { eraseGrammarEvidence, exportGrammarEvidence, recordGrammarDelta } from '../engine/visualGrammarEvidence';
import './VisualMusicGrammar.css';

const SHAPES = ['circle','triangle','square'];
const DIRECTIONS = ['rise','hold','fall'];
const INTENSITIES = ['soft','medium','bright'];
const FREQ = { circle: 220, triangle: 330, square: 440 };
const TRANSPOSE = { rise: 1.25, hold: 1, fall: .8 };
const GAIN = { soft: .025, medium: .05, bright: .085 };
const STORE = 'fia-visual-grammar-motif-v1';

function loadMotif() { try { return JSON.parse(localStorage.getItem(STORE) || '[]').slice(0, 12); } catch { return []; } }

export default function VisualMusicGrammar() {
  const [motif, setMotif] = useState(loadMotif);
  const [shape, setShape] = useState('circle');
  const [direction, setDirection] = useState('rise');
  const [intensity, setIntensity] = useState('soft');
  const [audioReady, setAudioReady] = useState(false);
  const [status, setStatus] = useState('Sound is asleep. Build visually or wake it explicitly.');
  const audioRef = useRef(null);
  const summary = useMemo(() => motif.map((token) => `${token.shape}-${token.direction}-${token.intensity}`).join(' · ') || 'empty motif', [motif]);

  const save = (next) => { setMotif(next); localStorage.setItem(STORE, JSON.stringify(next)); };
  const add = () => {
    const next = [...motif, { shape, direction, intensity }].slice(-12);
    save(next); recordGrammarDelta('grammar_token_added', { shape, direction, intensityBand: intensity, tokenCount: next.length });
  };
  const remove = (index) => {
    const token = motif[index]; const next = motif.filter((_, i) => i !== index); save(next);
    recordGrammarDelta('grammar_token_removed', { shape: token.shape, direction: token.direction, intensityBand: token.intensity, tokenCount: next.length });
  };
  const wake = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { setStatus('Audio is not supported here. The visual grammar still works.'); recordGrammarDelta('error', { errorCode: 'audio_unsupported' }); return; }
    if (!audioRef.current) audioRef.current = new AudioContext();
    await audioRef.current.resume(); setAudioReady(true); setStatus('Sound awake. Nothing plays until you press play motif.');
    recordGrammarDelta('audio_consent', { consent: true });
  };
  const play = async () => {
    if (!audioReady || !audioRef.current) { setStatus('Wake sound first.'); return; }
    const context = audioRef.current;
    motif.forEach((token, index) => {
      const start = context.currentTime + index * .28;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = token.shape === 'square' ? 'square' : token.shape === 'triangle' ? 'triangle' : 'sine';
      oscillator.frequency.value = FREQ[token.shape] * TRANSPOSE[token.direction];
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(GAIN[token.intensity], start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
      oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .24);
    });
    setStatus(motif.length ? `Playing ${motif.length} grammar tokens.` : 'The motif is empty.');
    recordGrammarDelta('motif_played', { tokenCount: motif.length });
  };
  const clear = () => { save([]); setStatus('Motif cleared.'); recordGrammarDelta('grammar_cleared', { tokenCount: 0 }); };
  const exportEvidence = () => {
    const payload = JSON.stringify(exportGrammarEvidence(), null, 2); const blob = new Blob([payload], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'fia-visual-grammar-evidence.json'; a.click(); URL.revokeObjectURL(url);
    recordGrammarDelta('motif_exported', { tokenCount: motif.length });
  };

  return <section className="visual-grammar" aria-labelledby="visual-grammar-title">
    <header><p>COMPOSITION FIELD 02</p><h2 id="visual-grammar-title">Draw a sentence the ear can read.</h2><span>Shape chooses timbre. Direction chooses pitch. Intensity chooses force.</span></header>
    <div className="grammar-builder">
      <fieldset><legend>shape</legend>{SHAPES.map((value) => <button key={value} aria-pressed={shape === value} onClick={() => setShape(value)}>{value}</button>)}</fieldset>
      <fieldset><legend>direction</legend>{DIRECTIONS.map((value) => <button key={value} aria-pressed={direction === value} onClick={() => setDirection(value)}>{value}</button>)}</fieldset>
      <fieldset><legend>intensity</legend>{INTENSITIES.map((value) => <button key={value} aria-pressed={intensity === value} onClick={() => setIntensity(value)}>{value}</button>)}</fieldset>
      <button className="grammar-add" onClick={add}>add token</button>
    </div>
    <div className="motif-canvas" role="list" aria-label="Current visual motif">
      {motif.length === 0 && <p>Choose a shape, direction, and intensity, then add a token.</p>}
      {motif.map((token, index) => <button key={`${token.shape}-${token.direction}-${token.intensity}-${index}`} role="listitem" className={`token ${token.shape} ${token.direction} ${token.intensity}`} onClick={() => remove(index)} aria-label={`Remove ${token.shape}, ${token.direction}, ${token.intensity}`}><i /></button>)}
    </div>
    <p className="grammar-summary" aria-live="polite">{summary}</p>
    <div className="grammar-actions">
      <button onClick={wake}>{audioReady ? 'sound awake' : 'wake sound'}</button><button onClick={play}>play motif</button><button onClick={clear}>clear motif</button>
      <button onClick={exportEvidence}>export learning evidence</button><button onClick={() => { eraseGrammarEvidence(); setStatus('Local interaction evidence erased.'); }}>erase evidence</button>
    </div>
    <p className="grammar-status" role="status">{status}</p>
    <footer>Saved only on this device · no microphone · no autoplay · no network analytics</footer>
  </section>;
}
