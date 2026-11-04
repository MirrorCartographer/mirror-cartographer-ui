import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, ROOM_COUNT, LAYERS_PER_ROOM, roomById } from '../world/roomCatalog';
import { createRoomAudio } from '../world/roomAudio';
import './RoomWorld.css';

const TAU = Math.PI * 2;
const KEY = 'mc-room-world-valid-v2';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const VALID_GESTURES = new Set(['tap', 'rapid', 'trace', 'fold', 'sweep', 'hold']);
const validRoomId = value => Number.isInteger(value) && value >= 1 && value <= ROOM_COUNT;
const sanitizeProgress = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const roomIds = input => Array.isArray(input) ? [...new Set(input.filter(validRoomId))] : [];
  const unlocked = roomIds(value.unlocked);
  const visited = roomIds(value.visited);
  if (!unlocked.includes(1)) unlocked.unshift(1);
  if (!visited.includes(1)) visited.unshift(1);
  const depth = {};
  if (value.depth && typeof value.depth === 'object' && !Array.isArray(value.depth)) {
    for (const [id, amount] of Object.entries(value.depth)) {
      const roomId = Number(id);
      if (validRoomId(roomId) && Number.isFinite(amount)) depth[String(roomId)] = clamp(amount, 1, LAYERS_PER_ROOM);
    }
  }
  const gestures = {};
  if (value.gestures && typeof value.gestures === 'object' && !Array.isArray(value.gestures)) {
    for (const [id, items] of Object.entries(value.gestures)) {
      const roomId = Number(id);
      if (validRoomId(roomId) && Array.isArray(items)) gestures[String(roomId)] = [...new Set(items.filter(item => VALID_GESTURES.has(item)))];
    }
  }
  return {
    roomId: validRoomId(value.roomId) && unlocked.includes(value.roomId) ? value.roomId : 1,
    unlocked, visited, depth,
    energy: Number.isFinite(value.energy) && value.energy >= 0 ? Math.min(value.energy, 1_000_000_000) : 0,
    gestures
  };
};
const load = () => {
  try { return sanitizeProgress(JSON.parse(localStorage.getItem(KEY) || 'null')); }
  catch { return sanitizeProgress(null); }
};
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
  const containDialogFocus = event => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="portal-map" role="dialog" aria-modal="true" aria-label="Room constellation" onKeyDown={containDialogFocus}>
    <button className="map-close" aria-label="Close constellation" autoFocus onClick={onClose}>×</button>
    <div className="portal-grid">{ROOMS.map((room) => {
      const open = progress.unlocked.includes(room.id);
      const seen = progress.visited.includes(room.id);
      return <button aria-label={open ? `Enter room ${room.id}, ${room.primary} form, ${room.motion} motion` : `Room ${room.id}, ${room.primary} form, locked`} key={room.id} disabled={!open} className={`portal ${open ? 'open' : ''} ${seen ? 'seen' : ''}`} style={{ '--c': room.palette[2] }} onClick={() => open && onEnter(room.id)}><i aria-hidden="true">{open ? '◇' : '·'}</i></button>;
    })}</div>
    <a className="map-all-rooms" href="./atlas/rooms/">All rooms and instruments ↗</a>
  </div>;
}

export default function RoomWorldValid() {
  const saved = load();
  const [progress, setProgress] = useState(() => ({ unlocked: [1], visited: [1], depth: { 1: 1 }, energy: 0, gestures: {}, ...saved }));
  const [roomId, setRoomId] = useState(saved.roomId || 1);
  const [depth, setDepth] = useState(Math.floor(saved.depth?.[saved.roomId || 1] || 1));
  const [pulse, setPulse] = useState(0.1);
  const [showMap, setShowMap] = useState(false);
  const [muted, setMuted] = useState(true);
  const [storageStatus, setStorageStatus] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const room = useMemo(() => roomById(roomId), [roomId]);
  const canvasRef = useRef(null);
  const drawFrameRef = useRef(null);
  const pointRef = useRef({ x: 0.5, y: 0.5, down: false, startX: 0.5, startY: 0.5, startedAt: 0 });
  const particlesRef = useRef([]);
  const audioRef = useRef(null);
  const mapButtonRef = useRef(null);

  useEffect(() => { audioRef.current = createRoomAudio(); return () => audioRef.current?.dispose(); }, []);
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return undefined;
    const updatePreference = event => setReducedMotion(event.matches);
    if (preference.addEventListener) preference.addEventListener('change', updatePreference);
    else preference.addListener?.(updatePreference);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener('change', updatePreference);
      else preference.removeListener?.(updatePreference);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...progress, roomId }));
      setStorageStatus('');
    } catch {
      setStorageStatus('Progress will not persist after this session.');
    }
  }, [progress, roomId]);
  useEffect(() => { const timer = setInterval(() => setPulse((value) => Math.max(0.06, value * 0.96)), reducedMotion ? 1000 : 100); return () => clearInterval(timer); }, [reducedMotion]);
  useEffect(() => { document.documentElement.classList.toggle('mc-reduced-motion', reducedMotion); window.dispatchEvent(new CustomEvent('mc:motion-preference', { detail: { reduced: reducedMotion } })); return () => document.documentElement.classList.remove('mc-reduced-motion'); }, [reducedMotion]);

  useEffect(() => {
    const charge = clamp((depth / LAYERS_PER_ROOM) * 0.72 + pulse * 0.28, 0.1, 1);
    document.documentElement.style.setProperty('--comet-core', room.palette[2]);
    document.documentElement.style.setProperty('--comet-wing', room.palette[3]);
    document.documentElement.style.setProperty('--comet-deep', room.palette[1]);
    window.dispatchEvent(new CustomEvent('mc:comet-state', { detail: { palette: room.palette, charge, depth, complete: depth === LAYERS_PER_ROOM } }));
  }, [room, depth, pulse]);

  const renderStateRef = useRef({ room, depth, pulse });
  useEffect(() => {
    renderStateRef.current = { room, depth, pulse };
  }, [room, depth, pulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let animation = 0;
    const start = performance.now();
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const frame = (now) => {
      const { room: activeRoom, depth: activeDepth, pulse: activePulse } = renderStateRef.current;
      const point = pointRef.current;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const gradient = ctx.createRadialGradient(
        width * (0.25 + point.x * 0.5),
        height * (0.2 + point.y * 0.5),
        0,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      gradient.addColorStop(0, activeRoom.palette[1]);
      gradient.addColorStop(0.58, activeRoom.palette[0]);
      gradient.addColorStop(1, '#020207');
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      activeRoom.layers.slice(0, activeDepth).forEach((layer) => (
        drawLayer(ctx, activeRoom, layer, width, height, now - start, point, activePulse)
      ));
      for (let i = particlesRef.current.length - 1; i >= 0; i -= 1) {
        const particle = particlesRef.current[i];
        particle.life -= 0.014;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(activeRoom.palette[2 + (i % 2)], particle.life);
        ctx.beginPath();
        ctx.arc(particle.x * width, particle.y * height, 1 + particle.life * 7, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!reducedMotion) animation = requestAnimationFrame(frame);
    };
    drawFrameRef.current = frame;
    resize();
    window.addEventListener('resize', resize);
    if (reducedMotion) frame(performance.now()); else animation = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener('resize', resize);
    };
  }, [reducedMotion]);
  useEffect(() => { if (reducedMotion) drawFrameRef.current?.(performance.now()); }, [room, depth, pulse, reducedMotion]);

  const record = (boost, gesture) => setProgress((current) => {
    const energy = current.energy + boost;
    const unlocked = new Set(current.unlocked);
    ROOMS.forEach((candidate) => { if (energy >= candidate.unlockCost) unlocked.add(candidate.id); });
    const rawDepth = Math.min(LAYERS_PER_ROOM, (current.depth?.[roomId] ?? depth) + boost * 0.9);
    const nextDepth = Math.min(LAYERS_PER_ROOM, Math.max(depth, Math.floor(rawDepth)));
    setDepth(nextDepth);
    return { ...current, energy, unlocked: [...unlocked].sort((a, b) => a - b), visited: [...new Set([...current.visited, roomId])], depth: { ...current.depth, [roomId]: rawDepth }, gestures: { ...current.gestures, [roomId]: [...new Set([...(current.gestures?.[roomId] || []), gesture])] } };
  });

  const signalComet = (event, boost, complete = false) => {
    window.dispatchEvent(new CustomEvent('mc:comet-state', { detail: {
      palette: room.palette,
      charge: clamp((depth / LAYERS_PER_ROOM) * 0.72 + pulse * 0.28 + boost * 0.2, 0.1, 1),
      x: event.clientX,
      y: event.clientY,
      complete,
    } }));
  };

  const interact = (event, type) => {
    if (type === 'down') event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    event.currentTarget.style.setProperty('--px', `${x * 100}%`);
    event.currentTarget.style.setProperty('--py', `${y * 100}%`);
    const previous = pointRef.current;
    const now = performance.now();
    const speed = Math.hypot(x - previous.x, y - previous.y);
    let gesture = 'tap';
    if (type === 'down') pointRef.current = { ...previous, x, y, down: true, startX: x, startY: y, startedAt: now };
    else if (type === 'move') { pointRef.current = { ...previous, x, y }; if (!previous.down) return; gesture = speed > 0.055 ? 'rapid' : Math.abs(x - previous.x) > Math.abs(y - previous.y) ? 'trace' : 'fold'; }
    else { const distance = Math.hypot(x - previous.startX, y - previous.startY); gesture = distance > 0.25 ? 'sweep' : now - previous.startedAt > 650 ? 'hold' : 'tap'; pointRef.current = { ...previous, x, y, down: false }; }
    const boost = type === 'move' && previous.down ? 0.06 : type === 'down' ? 0.72 : type === 'up' ? 0.4 : 0.01;
    record(boost, gesture);
    setPulse((value) => Math.min(1, value + boost * 0.3));
    signalComet(event, boost, depth === LAYERS_PER_ROOM);
    if (!muted) { audioRef.current?.wake(); gesture === 'hold' ? audioRef.current?.chord(room, room.layers[Math.max(0, depth - 1)], pulse) : audioRef.current?.voice(room, room.layers[Math.max(0, depth - 1)], pulse, x, y); }
    for (let i = 0; i < (type === 'down' ? 15 : 2); i += 1) particlesRef.current.push({ x, y, vx: (Math.random() - 0.5) * 0.006, vy: (Math.random() - 0.5) * 0.006, life: 0.4 + Math.random() * 0.6 });
  };

  const keyboardInteract = (event) => {
    const key = event.key;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(key)) return;
    event.preventDefault();
    const surface = event.currentTarget;
    const rect = surface.getBoundingClientRect();
    const previous = pointRef.current;
    const x = clamp(previous.x + (key === 'ArrowLeft' ? -0.08 : key === 'ArrowRight' ? 0.08 : 0));
    const y = clamp(previous.y + (key === 'ArrowUp' ? -0.08 : key === 'ArrowDown' ? 0.08 : 0));
    const target = { getBoundingClientRect: () => rect, style: surface.style };
    const point = { currentTarget: target, clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y };
    interact(point, 'down');
    if (key.startsWith('Arrow')) interact(point, 'move');
    interact(point, 'up');
  };

  const enter = (nextId) => { setRoomId(nextId); setDepth(Math.floor(progress.depth?.[nextId] || 1)); setShowMap(false); setProgress((current) => ({ ...current, visited: [...new Set([...current.visited, nextId])] })); };
  const nextRoom = (event) => {
    signalComet(event, 1, true);
    enter(progress.unlocked.find((candidate) => !progress.visited.includes(candidate)) || progress.unlocked[(progress.unlocked.indexOf(roomId) + 1) % progress.unlocked.length] || 1);
  };

  return <main className="room-world" style={{ '--p0': room.palette[0], '--p1': room.palette[1], '--p2': room.palette[2], '--p3': room.palette[3] }}>
    {storageStatus && <span className="storage-warning" role="status">{storageStatus}</span>}
    <button aria-label="Explore. Use arrow keys to move and Enter or Space to interact." aria-describedby="explore-help" className="world-surface" onKeyDown={keyboardInteract} onPointerDown={(event) => interact(event, 'down')} onPointerMove={(event) => interact(event, 'move')} onPointerUp={(event) => interact(event, 'up')} onPointerCancel={(event) => interact(event, 'up')}><canvas ref={canvasRef} /></button>
    <span id="explore-help" className="sr-only">Use the arrow keys to move through the field. Press Enter or Space to interact. Sound starts off. You can reduce motion.</span><span className="sr-only" aria-live="polite">Room {roomId} of {ROOM_COUNT}. {room.primary} form, {room.motion} motion. Layer {depth} of {LAYERS_PER_ROOM}.</span>
    <div className="depth-spine" aria-hidden="true">{Array.from({ length: LAYERS_PER_ROOM }, (_, index) => <i key={index} className={index < depth ? 'lit' : ''} />)}</div>
    <button ref={mapButtonRef} aria-label="Room constellation" className="world-map-button" onClick={() => setShowMap(true)}><span aria-hidden="true">✣</span></button>
    <button aria-label={muted ? 'Turn sound on' : 'Turn sound off'} className={`sound-orb ${muted ? 'muted' : ''}`} onClick={() => setMuted((value) => { const next = !value; next ? audioRef.current?.silence() : audioRef.current?.wake(); return next; })}><i /><i /><i /></button>
    <button aria-label={reducedMotion ? "Allow motion" : "Reduce motion"} aria-pressed={reducedMotion} className="motion-orb" onClick={() => setReducedMotion((value) => !value)}><span aria-hidden="true">◌</span></button>
    <div className="room-sigil" aria-hidden="true"><i /><span>{Array.from({ length: Math.min(9, Math.ceil(roomId / 12)) }, (_, index) => <b key={index} />)}</span></div>
    {depth === LAYERS_PER_ROOM && <button aria-label="Enter the next room" className="completion-portal" onClick={nextRoom}><i /></button>}
    {showMap && <PortalMap progress={progress} onEnter={enter} onClose={() => { setShowMap(false); requestAnimationFrame(() => mapButtonRef.current?.focus()); }} />}
  </main>;
}
