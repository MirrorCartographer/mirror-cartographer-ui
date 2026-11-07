import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, ROOM_COUNT, LAYERS_PER_ROOM, roomById } from '../world/roomCatalog';
import { createRoomAudio } from '../world/roomAudio';
import './RoomWorld.css';

const TAU = Math.PI * 2;
const KEY = 'mc-room-world-valid-v2';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const VALID_GESTURES = new Set(['tap', 'rapid', 'trace', 'fold', 'sweep', 'hold', 'hover']);
const validRoomId = value => Number.isInteger(value) && value >= 1 && value <= ROOM_COUNT;
const sanitizeProgress = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const roomIds = input => Array.isArray(input) ? [...new Set(input.filter(validRoomId))] : [];
  const unlocked = ROOMS.map((room) => room.id);
  const visited = roomIds(value.visited);
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
    <section className="found-rooms" aria-label="Discover working rooms inside the field">
      <div className="found-rooms-heading"><p>UNDER THE SURFACE / FIELD NOTES</p><h2>The world is strange.<br/><em>The rooms are real.</em></h2><span>The constellation is an atmosphere, not a category list. These are places you can actually enter and use.</span></div>
      <div className="found-rooms-grid">
        <a href="./?view=workshop"><small>THE LIVING COUNTRY / FIELD ATLAS</small><strong>The Living Country</strong><span>Move through the artist’s field notes, switch contexts, make fragments, and return to grounded care.</span><b>ENTER THE COUNTRY ↗</b></a>
        <a href="./atlas/rooms/signal-loom/"><small>BODY / EVIDENCE</small><strong>The Signal Loom</strong><span>Trace symptoms, measurements, interventions, context, and questions without turning a pattern into a diagnosis.</span><b>FOLLOW THE SIGNAL ↗</b></a>
        <a href="./atlas/rooms/after-the-uniform/"><small>VETERANS DAY / TRANSITION</small><strong>After the Uniform</strong><span>A human field notebook for the long transition: stability, health, records, work, education, and belonging.</span><b>FIND THE NEXT MOVE ↗</b></a>
        <a href="./atlas/rooms/body-archive/"><small>BODY / LOCAL ARCHIVE</small><strong>The Body Archive</strong><span>Keep direct observations, measurements, and possible explanations in separate places.</span><b>OPEN THE ARCHIVE ↗</b></a>
        <a href="./atlas/rooms/common-thread/"><small>PEOPLE / RELATIONSHIPS</small><strong>Common Thread</strong><span>Build a private constellation of people, places, groups, questions, and shared work.</span><b>TRACE A CONNECTION ↗</b></a>
        <a href="./atlas/rooms/screening-room/"><small>FILM / CULTURE</small><strong>The Picture House</strong><span>A little independent cinema. The current feature is a Veteran-made story of one person showing up for another.</span><b>ENTER THE SCREENING ↗</b></a>
        <a href="./atlas/rooms/arcade/veteran-mission/"><small>VETERAN / PRACTICAL PATH</small><strong>The Mission</strong><span>Turn a broad situation into a manageable path, with room for evidence, constraints, and the next action.</span><b>OPEN THE MISSION MAP ↗</b></a>
        <a href="./?view=workshop"><small>THE ENGINE ROOM / 31 WORKING LANES</small><strong>The Workshop</strong><span>Open the deeper instruments: health, body mapping, evidence, memory, projects, privacy, and creative work.</span><b>OPEN THE WORKSHOP ↗</b></a>
        <a href="./atlas/research-atlas/"><small>RESEARCH / PROVENANCE</small><strong>The Between</strong><span>Trace sources, claims, hypotheses, relationships, decisions, and uncertainty in a research instrument.</span><b>ENTER THE RESEARCH FIELD ↗</b></a>
        <a href="./commissions.html"><small>MAKE THE WORK SUSTAINABLE</small><strong>Commissions</strong><span>Request a private, source-aware map for a tangled decision, project, identity, or system.</span><b>WORK WITH THE CARTOGRAPHER ↗</b></a>
        <a href="./workbench.html"><small>PLAY / INSPECT / REMIX</small><strong>Source Workbench</strong><span>Open indexed HTML experiments, run them, inspect their source, and export local remixes.</span><b>OPEN THE WORKBENCH ↗</b></a>
      </div>
    </section>
    <div className="portal-grid">{ROOMS.map((room) => {
      const open = true;
      const seen = progress.visited.includes(room.id);
      return <button aria-label={open ? `Enter room ${room.id}, ${room.primary} form, ${room.motion} motion` : `Room ${room.id}, ${room.primary} form, locked`} key={room.id} className={`portal ${open ? 'open' : ''} ${seen ? 'seen' : ''}`} style={{ '--c': room.palette[2] }} onClick={() => open && onEnter(room.id)}><i aria-hidden="true">{open ? '◇' : '·'}</i></button>;
    })}</div>
    <a className="map-all-rooms" href="./atlas/rooms/">Browse all 39 rooms and instruments ↗</a>
  </div>;
}

export default function RoomWorldValid() {
  const saved = load();
  const [progress, setProgress] = useState(() => ({ unlocked: ROOMS.map((room) => room.id), visited: [1], depth: { 1: 1 }, energy: 0, gestures: {}, ...saved }));
  const [roomId, setRoomId] = useState(saved.roomId || 1);
  const depth = Math.floor(progress.depth?.[roomId] || 1);
  const [pulse, setPulse] = useState(0.1);
  const [showMap, setShowMap] = useState(false);
  const [muted, setMuted] = useState(true);
  const [storageStatus, setStorageStatus] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const room = useMemo(() => roomById(roomId), [roomId]);
  const canvasRef = useRef(null);
  const drawFrameRef = useRef(null);
  const pointRef = useRef({ x: 0.5, y: 0.5, down: false, startX: 0.5, startY: 0.5, startedAt: 0, lastHoverAt: 0 });
  const particlesRef = useRef([]);
  const audioRef = useRef(null);
  const mapButtonRef = useRef(null);
  const hoverTimerRef = useRef(null);

  useEffect(() => { audioRef.current = createRoomAudio(); return () => { if (hoverTimerRef.current) window.clearInterval(hoverTimerRef.current); audioRef.current?.dispose(); }; }, []);
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
    const rawDepth = Math.min(LAYERS_PER_ROOM, (current.depth?.[roomId] ?? depth) + boost * 0.9);
    return { ...current, energy, unlocked: ROOMS.map((room) => room.id), visited: [...new Set([...current.visited, roomId])], depth: { ...current.depth, [roomId]: rawDepth }, gestures: { ...current.gestures, [roomId]: [...new Set([...(current.gestures?.[roomId] || []), gesture])] } };
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
    if (type === 'down') { if (hoverTimerRef.current) window.clearInterval(hoverTimerRef.current); hoverTimerRef.current = null; event.currentTarget.setPointerCapture?.(event.pointerId); }
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

  const enter = (nextId) => { setRoomId(nextId); setShowMap(false); setProgress((current) => ({ ...current, visited: [...new Set([...current.visited, nextId])] })); };
  const nextRoom = (event) => {
    signalComet(event, 1, true);
    enter(progress.unlocked.find((candidate) => !progress.visited.includes(candidate)) || progress.unlocked[(progress.unlocked.indexOf(roomId) + 1) % progress.unlocked.length] || 1);
  };

  return <main className="room-world mc-afterimage-world" style={{ '--p0': room.palette[0], '--p1': room.palette[1], '--p2': room.palette[2], '--p3': room.palette[3] }}>
    <header className="mc-zine-masthead">
      <a className="mc-zine-brand" href="./atlas/"><span className="mc-brand-mark">✳</span><span>MIRROR CARTOGRAPHER<small>FIELD RECORDS · VOL. 01</small></span></a>
      <nav aria-label="Explore the archive"><a href="./atlas/">THE ATLAS ↗</a><a href="./?view=workshop">THE WORKSHOP ↗</a><a href="./atlas/rooms/music/">SOUND ARCHIVE ♫</a><a href="./art-machine/">IMAGE ORGANISM ↗</a></nav>
      <span className="mc-zine-edition">AN INDEPENDENT UNIVERSE / EST. IN CURIOSITY</span>
    </header>
    <div className="mc-zine-collage" aria-hidden="true">
      <div className="mc-paper-scrap mc-scrap-one">NOT ALL<br/>WHO WANDER<br/>ARE LOST.</div>
      <div className="mc-paper-scrap mc-scrap-two">SIDE B<br/>PLAY IT LOUD</div>
      <svg className="mc-zine-illustration" viewBox="0 0 680 760" role="presentation">
        <defs><filter id="mc-rough"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="12"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter><linearGradient id="mc-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9d1b6"/><stop offset=".48" stopColor="#8ba39a"/><stop offset="1" stopColor="#6c3347"/></linearGradient></defs>
        <path d="M337 45C480 63 588 190 570 336c-14 116-108 218-228 231-135 15-264-71-287-207C31 220 132 78 273 51" fill="none" stroke="#d8c8a5" strokeWidth="2" strokeDasharray="4 9"/>
        <path d="M100 540C174 449 214 337 239 205c15-76 56-126 111-153M234 608c47-125 67-212 55-305-11-83 12-137 73-187M405 628c-30-100-12-194 61-281 47-57 65-111 38-175" fill="none" stroke="#9cad83" strokeWidth="5" strokeLinecap="round"/>
        <g fill="#a8b58b" stroke="#e1d4b8" strokeWidth="2"><path d="M240 208c-82-18-113-72-98-131 69 1 117 45 113 108 30-75 81-104 143-93-8 72-58 118-131 119"/><path d="M290 302c-87-5-133-49-132-112 72-17 132 15 146 82 14-79 61-122 124-125 7 72-34 126-109 149"/><path d="M196 411c-76 19-131-10-148-68 56-41 121-31 158 26-12-76 17-131 77-155 35 66 16 130-55 176"/><path d="M390 420c34-77 92-104 151-80-9 70-57 112-124 106 70 27 98 79 82 139-71-7-115-55-109-126"/></g>
        <g fill="none" stroke="#d6c7a5" strokeWidth="3"><path d="M338 160c-83 54-114 145-91 253 19 91 3 157-48 206M337 160c74 53 110 145 83 253-22 83-10 151 42 205"/><circle cx="340" cy="355" r="128" strokeDasharray="2 10"/><circle cx="340" cy="355" r="91" stroke="#9db3a6"/><path d="M340 224v262M209 355h262M247 262l186 186M433 262L247 448" opacity=".7"/></g>
        <g filter="url(#mc-rough)"><circle cx="340" cy="355" r="88" fill="#6e3548" stroke="#ead9b8" strokeWidth="4"/><circle cx="340" cy="355" r="67" fill="url(#mc-glass)" stroke="#17131b" strokeWidth="5"/><path d="M310 350c22-27 49-27 70 0-21 28-48 28-70 0Z" fill="#17131b"/><circle cx="340" cy="350" r="13" fill="#e8d8b9"/></g>
        <g fill="#e5d5b5"><circle cx="115" cy="165" r="4"/><circle cx="510" cy="125" r="3"/><circle cx="548" cy="520" r="5"/><circle cx="145" cy="600" r="3"/></g><path d="M86 675c94-38 178-36 254 5 76 42 154 43 250 0" fill="none" stroke="#9bb7ae" strokeWidth="3"/>
      </svg><span className="mc-collage-caption">FIG. 01 — THE THING THAT LOOKS BACK</span>
    </div>
    <section className="mc-zine-copy" aria-label="Welcome">
      <p className="mc-zine-kicker">PERCEPTION IS NOT A FLOOR PLAN / THE MAP KEEPS MOVING</p><h1>THE WORLD<br/>KEEPS <em>SHIFTING.</em></h1>
      <p className="mc-zine-deck">Fragments arrive out of order. A sound becomes a place. A memory changes shape. Some signals are noise; some are evidence; some are doors. Follow a thread. The rooms inside can hold a piece still long enough to work with it.</p>
      <div className="mc-zine-actions"><a href="./atlas/">WANDER IN <span>↗</span></a><a href="./atlas/rooms/music/">PLAY SOMETHING <span>♫</span></a></div>
      <p className="mc-zine-footnote">CURRENT FREQUENCY: ROOM {String(roomId).padStart(2,'0')} / {room.primary.toUpperCase()}</p>
    </section><div className="mc-zine-stamp" aria-hidden="true">NO<br/>FIXED<br/>MEANING</div>
    {storageStatus && <span className="storage-warning" role="status">{storageStatus}</span>}
    <button aria-label="Explore. Use arrow keys to move and Enter or Space to interact." aria-describedby="explore-help" className="world-surface" onKeyDown={keyboardInteract} onPointerEnter={() => { if (hoverTimerRef.current) window.clearInterval(hoverTimerRef.current); hoverTimerRef.current = window.setInterval(() => { if (!pointRef.current.down) { record(0.045, 'hover'); setPulse((value) => Math.min(1, value + 0.018)); } }, 280); }} onPointerLeave={() => { if (hoverTimerRef.current) window.clearInterval(hoverTimerRef.current); hoverTimerRef.current = null; }} onPointerDown={(event) => interact(event, 'down')} onPointerMove={(event) => interact(event, 'move')} onPointerUp={(event) => interact(event, 'up')} onPointerCancel={(event) => interact(event, 'up')}><canvas ref={canvasRef} /></button>
    <span id="explore-help" className="sr-only">Use the arrow keys to move through the field. Press Enter or Space to interact. Sound starts off. You can reduce motion.</span><span className="sr-only" aria-live="polite">Room {roomId} of {ROOM_COUNT}. {room.primary} form, {room.motion} motion. Layer {depth} of {LAYERS_PER_ROOM}.</span>
    <div className="depth-spine" aria-hidden="true">{Array.from({ length: LAYERS_PER_ROOM }, (_, index) => <i key={index} className={index < depth ? 'lit' : ''} />)}</div>
    <button ref={mapButtonRef} aria-label="Room constellation" className="world-map-button" onClick={() => setShowMap(true)}><span aria-hidden="true">✣</span></button>
    <button aria-label={muted ? 'Turn sound on' : 'Turn sound off'} className={`sound-orb ${muted ? 'muted' : ''}`} onClick={() => { const next = !muted; setMuted(next); next ? audioRef.current?.silence() : audioRef.current?.wake(); }}><i /><i /><i /></button>
    <button aria-label={reducedMotion ? "Allow motion" : "Reduce motion"} aria-pressed={reducedMotion} className="motion-orb" onClick={() => setReducedMotion((value) => !value)}><span aria-hidden="true">◌</span></button>
    <div className="room-sigil" aria-hidden="true"><i /><span>{Array.from({ length: Math.min(9, Math.ceil(roomId / 12)) }, (_, index) => <b key={index} />)}</span></div>
    {depth === LAYERS_PER_ROOM && <button aria-label="Enter the next room" className="completion-portal" onClick={nextRoom}><i /></button>}
    {showMap && <PortalMap progress={progress} onEnter={enter} onClose={() => { setShowMap(false); requestAnimationFrame(() => mapButtonRef.current?.focus()); }} />}
  </main>;
}
