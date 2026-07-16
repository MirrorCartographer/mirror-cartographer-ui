import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appendSpatialDelta, eraseSpatialEvidence, exportSpatialEvidence } from '../engine/spatialFieldEvidence';
import './SpatialSoundField.css';

const STORE = 'fia-spatial-field-state-v1';
const defaults = [
  { id: 'ember', label: 'Ember', x: .24, y: .34, hue: 18 },
  { id: 'tide', label: 'Tide', x: .72, y: .58, hue: 196 },
  { id: 'moss', label: 'Moss', x: .46, y: .78, hue: 112 }
];
const clamp = (n) => Math.max(.04, Math.min(.96, n));

function loadBodies() {
  try { const v = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(v) ? v : defaults; }
  catch { return defaults; }
}

export default function SpatialSoundField() {
  const [bodies, setBodies] = useState(() => loadBodies());
  const [audioReady, setAudioReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Sound is asleep. Move the bodies visually, or wake sound explicitly.');
  const audio = useRef(null);
  const timers = useRef([]);
  const fieldRef = useRef(null);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(bodies)); }, [bodies]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); audio.current?.close?.(); appendSpatialDelta('field_stopped', { durationMs: Date.now() - startedAt }); }, [startedAt]);

  const wake = async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setStatus('This browser cannot create audio, but the visual instrument still works.'); appendSpatialDelta('error', { code: 'audio_unsupported' }); return; }
    if (!audio.current) audio.current = new AC();
    await audio.current.resume();
    setAudioReady(true); setStatus('Sound awake. Nothing plays until you choose a body or play the field.');
    appendSpatialDelta('audio_consent', { input: 'button' });
  };

  const voice = async (body, delay = 0) => {
    if (!audioReady || !audio.current) return;
    const ctx = audio.current;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const filter = ctx.createBiquadFilter(); const now = ctx.currentTime + delay;
    const dx = body.x - .5, dy = body.y - .5, distance = Math.min(1, Math.hypot(dx, dy) * 1.42);
    osc.type = body.id === 'ember' ? 'triangle' : body.id === 'tide' ? 'sine' : 'square';
    osc.frequency.value = 110 * Math.pow(2, (1 - body.y) * 2.2);
    filter.type = 'lowpass'; filter.frequency.value = 500 + (1 - body.y) * 4200;
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.035 + (1 - distance) * .08, now + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + .55);
    osc.connect(filter).connect(gain);
    if (pan) { pan.pan.value = body.x * 2 - 1; gain.connect(pan).connect(ctx.destination); } else gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + .62);
  };

  const playBody = (body, input = 'button') => { voice(body); setStatus(`${body.label}: ${body.x < .4 ? 'left' : body.x > .6 ? 'right' : 'center'}, ${body.y < .4 ? 'high' : body.y > .6 ? 'low' : 'middle'}.`); appendSpatialDelta('body_played', { x: body.x, y: body.y, distance: Math.hypot(body.x - .5, body.y - .5), input }); };
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; setPlaying(false); setStatus('Field stopped.'); appendSpatialDelta('field_stopped', { durationMs: Date.now() - startedAt }); };
  const playField = async () => { if (!audioReady) { setStatus('Wake sound first.'); return; } stop(); setPlaying(true); bodies.forEach((body, i) => timers.current.push(setTimeout(() => playBody(body), i * 360))); timers.current.push(setTimeout(() => setPlaying(false), bodies.length * 360 + 700)); appendSpatialDelta('field_played', { count: bodies.length, input: 'button' }); };

  const move = (id, x, y, input) => { setBodies(v => v.map(b => b.id === id ? { ...b, x: clamp(x), y: clamp(y) } : b)); appendSpatialDelta('body_moved', { x, y, distance: Math.hypot(x - .5, y - .5), input }); };
  const pointerMove = (event, body) => { if (event.buttons !== 1 || !fieldRef.current) return; const r = fieldRef.current.getBoundingClientRect(); move(body.id, (event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height, event.pointerType === 'touch' ? 'touch' : 'pointer'); };
  const keyMove = (event, body) => { const d = event.shiftKey ? .08 : .025; const map = { ArrowLeft: [-d,0], ArrowRight:[d,0], ArrowUp:[0,-d], ArrowDown:[0,d] }; if (!map[event.key]) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); playBody(body, 'keyboard'); } return; } event.preventDefault(); move(body.id, body.x + map[event.key][0], body.y + map[event.key][1], 'keyboard'); };

  const reset = () => { stop(); setBodies(defaults); setStatus('Field returned to its opening constellation.'); appendSpatialDelta('field_reset', { count: defaults.length, input: 'button' }); };
  const download = () => { const blob = new Blob([JSON.stringify(exportSpatialEvidence(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'spatial-field-evidence.json'; a.click(); URL.revokeObjectURL(a.href); appendSpatialDelta('evidence_exported', { input: 'button' }); };
  const erase = () => { eraseSpatialEvidence(); setStatus('Local interaction evidence erased. The composition itself remains.'); };

  return <main className="spatial-page">
    <header><p>FOUNDATION INTELLIGENCE / COMPOSITION FIELD 03</p><h1>Place sound in the room.</h1><span>Left becomes pan. Height becomes pitch and brightness. Distance from the center becomes presence.</span></header>
    <section className="spatial-toolbar" aria-label="Sound and evidence controls">
      <button className="wake" onClick={wake} disabled={audioReady}>{audioReady ? 'sound awake' : 'wake sound'}</button>
      <button onClick={playing ? stop : playField}>{playing ? 'stop field' : 'play field'}</button><button onClick={reset}>reset constellation</button><button onClick={download}>export evidence</button><button onClick={erase}>erase evidence</button>
    </section>
    <p className="spatial-status" role="status" aria-live="polite">{status}</p>
    <section className="spatial-field" ref={fieldRef} aria-label="Spatial sound field. Use arrow keys to move a selected sound body and Enter to play it.">
      <i className="center-mark" aria-hidden="true" />
      {bodies.map(body => <button key={body.id} className="sound-body" style={{ '--x': body.x, '--y': body.y, '--hue': body.hue }} onPointerMove={e => pointerMove(e, body)} onPointerDown={e => e.currentTarget.setPointerCapture?.(e.pointerId)} onKeyDown={e => keyMove(e, body)} onClick={() => playBody(body)} aria-label={`${body.label}. Position ${Math.round(body.x * 100)} percent across and ${Math.round(body.y * 100)} percent down.`}><span>{body.label}</span></button>)}
    </section>
    <aside className="mapping-key"><span>← left / right → pan</span><span>↑ high / low ↓ pitch</span><span>center = present</span><span>edge = distant</span></aside>
    <footer><span>saved only on this device</span><span>no microphone</span><span>no autoplay</span><span>no network analytics</span></footer>
  </main>;
}
