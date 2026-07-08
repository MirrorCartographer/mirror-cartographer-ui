import React, { useEffect, useRef, useState } from 'react';
import { PERFORMANCE_BUDGET, SKY_STATES, evolveWeatherGesture, normalizePoint, responsiveBudget, skyState } from '../engine/skyState';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const lerp = (a, b, t) => a + (b - a) * t;

function seeds(count, map) {
  return Array.from({ length: count }, (_, i) => map(i));
}

function colorFor(kind, alpha = 1) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

function safeMarks(items) {
  const now = Date.now();
  return items
    .filter((mark) => mark && Number.isFinite(mark.x) && Number.isFinite(mark.y))
    .map((mark) => ({
      x: clamp01(mark.x),
      y: clamp01(mark.y),
      px: clamp01(mark.prev?.x ?? mark.x),
      py: clamp01(mark.prev?.y ?? mark.y),
      kind: SKY_STATES.includes(mark.kind) ? mark.kind : 'cloud',
      spin: Number.isFinite(mark.spin) ? mark.spin : 0,
      time: Number.isFinite(mark.time) ? mark.time : now,
    }));
}

function useWordlessSky(state, pulse, marks, rhythm) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: false });
    let raf = 0;
    let frame = 0;
    const stars = seeds(180, (i) => ({ i, x: Math.random(), y: Math.random(), r: 0.35 + Math.random() * 1.8, s: 0.3 + Math.random() * 1.7 }));
    const motes = seeds(68, (i) => ({ i, x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 2.2, p: Math.random() * TAU, s: 0.4 + Math.random() * 1.9 }));
    const veins = seeds(18, (i) => ({ i, y: 0.08 + Math.random() * 0.76, p: Math.random() * TAU, a: 18 + Math.random() * 72 }));
    const raindrops = seeds(150, (i) => ({ i, x: Math.random(), y: Math.random(), l: 16 + Math.random() * 54, s: 5 + Math.random() * 13 }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(PERFORMANCE_BUDGET.maxPixelRatio, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const glow = (x, y, radius, color, alpha) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colorFor(color, alpha));
      gradient.addColorStop(1, colorFor(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    };

    const drawBreathingHeart = (w, h, t, spec) => {
      const cx = w * 0.5;
      const cy = h * 0.58;
      const scale = Math.min(w, h) * (0.105 + pulse * 0.025 + Math.sin(t * 0.035) * 0.006);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = colorFor(state, 0.74);
      ctx.fillStyle = colorFor(state, 0.075);
      ctx.shadowColor = colorFor(state, 1);
      ctx.shadowBlur = 36 + pulse * 22;
      ctx.lineWidth = Math.max(1.2, scale * 0.035);
      ctx.beginPath();
      for (let i = 0; i <= 140; i += 1) {
        const a = (i / 140) * TAU;
        const warp = 1 + Math.sin(a * 3 + t * 0.018) * 0.04 * spec.motion;
        const x = Math.sin(a) ** 3 * scale * 1.2 * warp;
        const y = -(0.78 * Math.cos(a) - 0.3 * Math.cos(2 * a) - 0.12 * Math.cos(3 * a) - 0.06 * Math.cos(4 * a)) * scale * warp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawGestureMemory = (w, h, t, active) => {
      active.forEach((mark, index) => {
        const age = Math.min(1, (Date.now() - mark.time) / 8200);
        const life = 1 - age;
        if (life <= 0.02) return;
        const cx = mark.x * w;
        const cy = mark.y * h;
        const base = Math.min(w, h) * (0.04 + index * 0.004 + pulse * 0.02);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = colorFor(mark.kind, 0.2 + life * 0.42);
        ctx.fillStyle = colorFor(mark.kind, 0.035 + life * 0.06);
        ctx.shadowColor = colorFor(mark.kind, 0.9);
        ctx.shadowBlur = 22 * life;
        ctx.lineWidth = 0.8 + pulse * 1.4;
        for (let ring = 0; ring < 3; ring += 1) {
          const radius = base + age * Math.min(w, h) * (0.18 + ring * 0.09);
          ctx.globalAlpha = life * (0.46 - ring * 0.1);
          ctx.beginPath();
          for (let p = 0; p <= 80; p += 1) {
            const a = (p / 80) * TAU;
            const r = radius + Math.sin(a * 5 + t * 0.035 + mark.spin) * (4 + rhythm * 0.55) * life;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r * lerp(0.62, 0.86, pulse);
            if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.globalAlpha = life * 0.34;
        ctx.beginPath();
        ctx.moveTo(mark.px * w, mark.py * h);
        const midX = lerp(mark.px * w, cx, 0.5) + Math.sin(t * 0.03 + index) * 24 * life;
        const midY = lerp(mark.py * h, cy, 0.5) - Math.cos(t * 0.026 + index) * 18 * life;
        ctx.quadraticCurveTo(midX, midY, cx, cy);
        ctx.stroke();
        ctx.restore();
      });
    };

    const drawGlyph = (w, h, t, active) => {
      const cx = w - Math.min(72, w * 0.16);
      const cy = Math.min(72, h * 0.16);
      const radius = Math.min(w, h) * 0.04;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.01 + rhythm * 0.015);
      ctx.strokeStyle = colorFor(state, 0.58);
      ctx.shadowColor = colorFor(state, 1);
      ctx.shadowBlur = 24;
      ctx.lineWidth = 1.4;
      const spokes = state === 'rain' ? 5 : state === 'lightning' ? 3 : state === 'wind' ? 4 : 6;
      for (let i = 0; i < spokes; i += 1) {
        const a = (i / spokes) * TAU + Math.sin(t * 0.025 + i) * 0.08;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.35, Math.sin(a) * radius * 0.35);
        ctx.lineTo(Math.cos(a) * radius * (1.15 + pulse * 0.5), Math.sin(a) * radius * (1.15 + pulse * 0.5));
        ctx.stroke();
      }
      if (active.length) {
        ctx.globalAlpha = 0.34;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (1.5 + pulse * 0.8), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    };

    const loop = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const budget = responsiveBudget(w, h);
      const t = frame;
      const spec = skyState(state);
      const active = safeMarks(marks).slice(-(budget.mobile ? 12 : 20));

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, spec.sky[0]);
      sky.addColorStop(0.5, spec.sky[1]);
      sky.addColorStop(1, spec.sky[2]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      glow(w * 0.22, h * 0.18, w * 0.48, state === 'rain' ? 'rain' : 'clear', state === 'clear' ? 0.28 : 0.11);
      glow(w * 0.82, h * 0.16, w * 0.42, state === 'murmur' ? 'murmur' : state === 'aurora' ? 'aurora' : 'dawn', 0.1 + pulse * 0.1);
      if (state === 'dawn') glow(w * 0.5, h * 1.03, w * 0.7, 'dawn', 0.42);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const starCount = Math.min(stars.length, budget.stars || stars.length);
      for (let i = 0; i < starCount; i += 1) {
        const s = stars[i];
        ctx.globalAlpha = Math.max(0, 0.12 + Math.sin(t * 0.022 * s.s + s.i) * 0.13 + (state === 'clear' ? 0.22 : 0));
        ctx.fillStyle = '#fff8ef';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.76, s.r, 0, TAU);
        ctx.fill();
      }

      const veinCount = budget.mobile ? 7 : veins.length;
      for (let i = 0; i < veinCount; i += 1) {
        const v = veins[i];
        const pull = active.reduce((sum, mark) => sum + Math.sin(mark.x * 8 + mark.y * 5 + v.i) * 0.18, 0);
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, colorFor(state, 0));
        gradient.addColorStop(0.5, colorFor(state, 0.09 + pulse * 0.12));
        gradient.addColorStop(1, colorFor(state, 0));
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = state === 'wind' || state === 'murmur' || state === 'aurora' ? 0.76 : 0.32;
        ctx.lineWidth = 1 + pulse * 3;
        ctx.beginPath();
        for (let x = -60; x <= w + 60; x += 18) {
          const y = h * v.y + Math.sin(x * 0.01 + t * 0.018 + v.p + pull) * (v.a + pulse * 46);
          if (x === -60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const moteCount = Math.min(motes.length, budget.pollen || motes.length);
      for (let i = 0; i < moteCount; i += 1) {
        const mote = motes[i];
        const drift = state === 'wind' || state === 'murmur' ? 2.9 : 1.05;
        const x = ((mote.x * w + t * mote.s * drift) % (w + 90)) - 45;
        const y = mote.y * h + Math.sin(t * 0.018 + mote.p) * 20;
        ctx.globalAlpha = 0.07 + pulse * 0.2;
        ctx.fillStyle = colorFor(state, 0.62);
        ctx.beginPath();
        ctx.arc(x, y, mote.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      drawGestureMemory(w, h, t, active);

      if (state === 'rain') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = colorFor('rain', 0.5 + pulse * 0.22);
        ctx.lineWidth = 1;
        const rainCount = Math.min(raindrops.length, budget.rainDrops || raindrops.length);
        for (let i = 0; i < rainCount; i += 1) {
          const drop = raindrops[i];
          const y = ((drop.y * h + t * drop.s * (1 + rhythm * 0.03)) % (h + 90)) - 70;
          const x = drop.x * w + Math.sin(t * 0.011 + drop.i) * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 8, y + drop.l);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (state === 'lightning' && (Math.sin(t * 0.12) > 0.72 || pulse > 0.82)) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = colorFor('lightning', 0.14 + pulse * 0.08);
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = colorFor('lightning', 0.82);
        ctx.shadowColor = colorFor('lightning', 1);
        ctx.shadowBlur = 32;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        let x = w * (0.25 + Math.sin(t * 0.021) * 0.16);
        let y = 0;
        ctx.moveTo(x, y);
        for (let i = 0; i < 9; i += 1) {
          x += Math.sin(t * 0.07 + i * 2.4) * 42;
          y += h * 0.07 + Math.abs(Math.sin(t * 0.033 + i)) * 28;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      drawBreathingHeart(w, h, t, spec);
      drawGlyph(w, h, t, active);
      raf = requestAnimationFrame(loop);
    };

    resize();
    loop();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [state, pulse, marks, rhythm]);

  return ref;
}

export default function App() {
  const [state, setState] = useState('cloud');
  const [pulse, setPulse] = useState(0.5);
  const [marks, setMarks] = useState([]);
  const [rhythm, setRhythm] = useState(0);
  const lastTouch = useRef(0);
  const canvasRef = useWordlessSky(state, pulse, marks, rhythm);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulse((value) => Math.max(PERFORMANCE_BUDGET.pulseFloor, value * PERFORMANCE_BUDGET.pulseDecay));
      setRhythm((value) => Math.max(0, value - PERFORMANCE_BUDGET.rhythmDecay));
    }, PERFORMANCE_BUDGET.tickMs);
    return () => window.clearInterval(id);
  }, []);

  const touch = (event) => {
    const point = normalizePoint(event);
    const now = Date.now();
    setMarks((items) => {
      const prev = safeMarks(items).at(-1) || null;
      return [...safeMarks(items).slice(-PERFORMANCE_BUDGET.maxMarks), { ...point, prev, time: now, spin: Math.random() * TAU, kind: state }];
    });
    const gesture = evolveWeatherGesture({ now, lastTouch: lastTouch.current, rhythm, pulse, state, point });
    lastTouch.current = now;
    setRhythm(gesture.rhythm);
    setState(gesture.kind);
    setPulse((value) => Math.min(1, value + gesture.pulseBoost));
  };

  return (
    <main className="wordless" aria-label="wordless sky instrument">
      <style>{css}</style>
      <button className="sky" onPointerDown={touch} aria-label="touch the sky">
        <canvas ref={canvasRef} />
      </button>
      <div className="orbit" aria-hidden="true">
        {SKY_STATES.map((name) => <i key={name} className={name === state ? 'on' : ''} />)}
      </div>
    </main>
  );
}

const css = `
*{box-sizing:border-box}
html,body,#root{min-height:100%;margin:0;background:#050510}
body{overflow:hidden;overscroll-behavior:none;touch-action:none}
.wordless{min-height:100vh;color:transparent;background:#050510;-webkit-user-select:none;user-select:none}
.sky{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#050510;cursor:crosshair;touch-action:none;-webkit-tap-highlight-color:transparent}
.sky canvas{display:block;width:100%;height:100%}
.orbit{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:10px;padding:11px 14px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(5,5,16,.34);backdrop-filter:blur(18px);box-shadow:0 18px 70px rgba(0,0,0,.34);pointer-events:none}
.orbit i{width:9px;height:9px;border-radius:999px;background:rgba(255,255,255,.24);box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 18px rgba(255,255,255,.08);transition:transform .24s ease,background .24s ease,box-shadow .24s ease}
.orbit i.on{background:#ffe2bf;box-shadow:0 0 24px #ffbe74,0 0 0 1px rgba(255,255,255,.58);transform:scale(1.52)}
@media(max-width:700px){.orbit{bottom:max(14px,env(safe-area-inset-bottom));gap:8px;padding:10px 12px}.orbit i{width:8px;height:8px}}
@media(prefers-reduced-motion:reduce){.orbit i{transition:none}}
`;