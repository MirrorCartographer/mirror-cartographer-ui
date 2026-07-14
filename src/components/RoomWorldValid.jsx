import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, LAYERS_PER_ROOM, roomById } from '../world/roomCatalog';
import { createRoomAudio } from '../world/roomAudio';
import './RoomWorld.css';

const TAU = Math.PI * 2;
const KEY = 'mc-room-world-valid-v1';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const rgba = (hex, alpha) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`; };

function drawLayer(ctx, room, layer, width, height, time, point, pulse) {
  const radius = Math.min(width, height) * (0.04 + layer.index * 0.021) * layer.scale;
  const count = 4 + Math.floor(layer.density * 12);
  ctx.save();
  ctx.translate(width / 2 + (point.x - 0.5) * width * layer.index / 400, height / 2 + (point.y - 0.5) * height * layer.index / 400);
  ctx.rotate(layer.rotation + time * 0.00002 * (room.gravity || 0.2));
  ctx.globalCompositeOperation = layer.index % 3 ? 'screen' : 'lighter';
  ctx.lineWidth = 0.5 + (layer.index % 4) * 0.25;
  ctx.strokeStyle = rgba(room.palette[2 + (layer.index % 2)], 0.05 + layer.density * 0.1 + pulse * 0.03);
  ctx.fillStyle = rgba(room.palette[2 + (layer.index % 2)], 0.015 + layer.density * 0.03);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + time * 0.00008 * (i % 2 ? 1 : -1);
    const sides = 3 + ((room.portalShape + i + layer.index) % 7);
    const local = radius * (0.15 + (i / count) * 0.88);
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(layer.form === 'tide' ? Math.sin(time * 0.001 + i) * radius * 0.2 : 0, layer.form === 'storm' ? Math.cos(time * 0.0015 + i) * radius * 0.18 : 0);
    ctx.beginPath();
    for (let p = 0; p <= sides; p += 1) {
      const a = (p / sides) * TAU;
      const wobble = 1 + Math.sin(time * 0.001 + p + layer.seed) * 0.08;
      const x = Math.cos(a) * local * wobble;
      const y = Math.sin(a) * local * wobble;
      p ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    i % 3 ? ctx.stroke() : ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function PortalMap({ progress, onEnter, onClose }) {
  return <div className="portal-map">
    <button className="map-close" onClick={onClose}>×</button>
    <div className="portal-grid">{ROOMS.map((room) => {
      const open = progress.unlocked.includes(room.id);
      const seen = progress.visited.includes(room.id);
      return <button key={room.id} disabled={!open} className={`portal ${open ? 'open' : ''} ${seen ? 'seen' : ''}`} style={{ '--c': room.palette[2] }} onClick={() => open && onEnter(room.id)}><i>{open ? '◇' : '·'}</i></button>;
    })}</div>
  </div>;
}

export default function RoomWorldValid() {
  const saved = load();
  const [progress, setProgress] = useState(() => ({ unlocked: [1], visited: [1], depth: { 1: 1 }, energy: 0, gestures: {}, ...saved }));
  const [roomId, setRoomId] = useState(saved.roomId || 1);
  const [depth, setDepth] = useState(saved.depth?.[saved.roomId || 1] || 1);
  const [pulse, setPulse] = useState(0.1);
  const [showMap, setShowMap] = useState(false);
  const [muted, setMuted] = useState(false);
  const room = useMemo(() => roomById(roomId), [roomId]);
  const canvasRef = useRef(null);
  const pointRef = useRef({ x: 0.5, y: 0.5, down: false, startX: 0.5, startY: 0.5, startedAt: 0 });
  const particlesRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => { audioRef.current = createRoomAudio(); return () => audioRef.current?.dispose(); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ ...progress, roomId })); }, [progress, roomId]);
  useEffect(() => { const timer = setInterval(() => setPulse((value) => Math.max(0.06, value * 0.96)), 100); return () => clearInterval(timer); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animation = 0;
    const start = performance.now();
    const resize = () => { const ratio = Math.min(2, window.devicePixelRatio || 1); const rect = canvas.getBoundingClientRect(); canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); };
    const frame = (now) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const gradient = ctx.createRadialGradient(width * (0.25 + pointRef.current.x * 0.5), height * (0.2 + pointRef.current.y * 0.5), 0, width / 2, height / 2, Math.max(width, height));
      gradient.addColorStop(0, room.palette[1]); gradient.addColorStop(0.58, room.palette[0]); gradient.addColorStop(1, '#020207');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      room.layers.slice(0, depth).forEach((layer) => drawLayer(ctx, room, layer, width, height, now - start, pointRef.current, pulse));
      for (let i = particlesRef.current.length - 1; i >= 0; i -= 1) { const particle = particlesRef.current[i]; particle.life -= 0.014; particle.x += particle.vx; particle.y += particle.vy; if (particle.life <= 0) { particlesRef.current.splice(i, 1); continue; } ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(room.palette[2 + (i % 2)], particle.life); ctx.beginPath(); ctx.arc(particle.x * width, particle.y * height, 1 + particle.life * 7, 0, TAU); ctx.fill(); }
      animation = requestAnimationFrame(frame);
    };
    resize(); window.addEventListener('resize', resize); animation = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(animation); window.removeEventListener('resize', resize); };
  }, [room, depth, pulse]);

  const record = (boost, gesture) => setProgress((current) => {
    const energy = current.energy + boost;
    const unlocked = new Set(current.unlocked);
    ROOMS.forEach((candidate) => { if (energy >= candidate.unlockCost) unlocked.add(candidate.id); });
    const rawDepth = (current.depth?.[roomId] || 1) + boost * 0.9;
    const nextDepth = Math.min(LAYERS_PER_ROOM, Math.max(depth, Math.floor(rawDepth)));
    setDepth(nextDepth);
    return { ...current, energy, unlocked: [...unlocked].sort((a, b) => a - b), visited: [...new Set([...current.visited, roomId])], depth: { ...current.depth, [roomId]: nextDepth }, gestures: { ...current.gestures, [roomId]: [...new Set([...(current.gestures?.[roomId] || []), gesture])] } };
  });

  const interact = (event, type) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    const previous = pointRef.current;
    const now = performance.now();
    const speed = Math.hypot(x - previous.x, y - previous.y);
    let gesture = 'tap';
    if (type === 'down') pointRef.current = { ...previous, x, y, down: true, startX: x, startY: y, startedAt: now };
    else if (type === 'move') { pointRef.current = { ...previous, x, y }; gesture = speed > 0.055 ? 'rapid' : Math.abs(x - previous.x) > Math.abs(y - previous.y) ? 'trace' : 'fold'; }
    else { const distance = Math.hypot(x - previous.startX, y - previous.startY); gesture = distance > 0.25 ? 'sweep' : now - previous.startedAt > 650 ? 'hold' : 'tap'; pointRef.current = { ...previous, x, y, down: false }; }
    const boost = type === 'move' && previous.down ? 0.06 : type === 'down' ? 0.72 : type === 'up' ? 0.4 : 0.01;
    record(boost, gesture);
    setPulse((value) => Math.min(1, value + boost * 0.3));
    if (!muted) { audioRef.current?.wake(); gesture === 'hold' ? audioRef.current?.chord(room, room.layers[Math.max(0, depth - 1)], pulse) : audioRef.current?.voice(room, room.layers[Math.max(0, depth - 1)], pulse, x, y); }
    for (let i = 0; i < (type === 'down' ? 15 : 2); i += 1) particlesRef.current.push({ x, y, vx: (Math.random() - 0.5) * 0.006, vy: (Math.random() - 0.5) * 0.006, life: 0.4 + Math.random() * 0.6 });
  };

  const enter = (nextId) => { setRoomId(nextId); setDepth(progress.depth?.[nextId] || 1); setShowMap(false); setProgress((current) => ({ ...current, visited: [...new Set([...current.visited, nextId])] })); };
  const nextRoom = () => enter(progress.unlocked.find((candidate) => !progress.visited.includes(candidate)) || progress.unlocked[(progress.unlocked.indexOf(roomId) + 1) % progress.unlocked.length] || 1);

  return <main className="room-world" style={{ '--p0': room.palette[0], '--p1': room.palette[1], '--p2': room.palette[2], '--p3': room.palette[3] }}>
    <button className="world-surface" onPointerDown={(event) => interact(event, 'down')} onPointerMove={(event) => interact(event, 'move')} onPointerUp={(event) => interact(event, 'up')} onPointerCancel={(event) => interact(event, 'up')}><canvas ref={canvasRef} /></button>
    <div className="depth-spine">{Array.from({ length: LAYERS_PER_ROOM }, (_, index) => <i key={index} className={index < depth ? 'lit' : ''} />)}</div>
    <button className="world-map-button" onClick={() => setShowMap(true)}><span>✣</span><b>{progress.unlocked.length}</b></button>
    <button className={`sound-orb ${muted ? 'muted' : ''}`} onClick={() => setMuted((value) => { const next = !value; next ? audioRef.current?.silence() : audioRef.current?.wake(); return next; })}><i /><i /><i /></button>
    <div className="room-sigil"><i /><span>{Array.from({ length: Math.min(9, Math.ceil(roomId / 12)) }, (_, index) => <b key={index} />)}</span></div>
    {depth === LAYERS_PER_ROOM && <button className="completion-portal" onClick={nextRoom}><i /></button>}
    {showMap && <PortalMap progress={progress} onEnter={enter} onClose={() => setShowMap(false)} />}
  </main>;
}
