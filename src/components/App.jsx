import React, { useEffect, useRef, useState } from 'react';
import {
  PERFORMANCE_BUDGET,
  SKY_STATES,
  evolveWeatherGesture,
  normalizePoint,
  responsiveBudget,
  skyState,
} from '../engine/skyState';
import { createCreatureWeather, drawCreatureWeather } from '../engine/creatureWeather';
import { createGestureComets, drawGestureComets } from '../engine/gestureComets';
import { createSkyMusic } from '../engine/skyMusic';
import { createCompositionClock } from '../engine/compositionClock';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const seed = (count, factory) => Array.from({ length: count }, (_, i) => factory(i));

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
  return (Array.isArray(items) ? items : [])
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

function drawGlow(ctx, x, y, radius, kind, alpha) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, colorFor(kind, alpha));
  glow.addColorStop(1, colorFor(kind, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function drawHeart(ctx, env, spec) {
  const { width: w, height: h, time: t, pulse, state } = env;
  const scale = Math.min(w, h) * (0.105 + pulse * 0.025 + Math.sin(t * 0.035) * 0.006);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.58);
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = colorFor(state, 0.74);
  ctx.fillStyle = colorFor(state, 0.075);
  ctx.shadowColor = colorFor(state, 1);
  ctx.shadowBlur = 36 + pulse * 22;
  ctx.lineWidth = Math.max(1.2, scale * 0.035);
  ctx.beginPath();
  for (let i = 0; i <= 140; i += 1) {
    const angle = (i / 140) * TAU;
    const warp = 1 + Math.sin(angle * 3 + t * 0.018) * 0.04 * spec.motion;
    const x = Math.sin(angle) ** 3 * scale * 1.2 * warp;
    const y = -(
      0.78 * Math.cos(angle) -
      0.3 * Math.cos(2 * angle) -
      0.12 * Math.cos(3 * angle) -
      0.06 * Math.cos(4 * angle)
    ) * scale * warp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMemory(ctx, env) {
  const { width: w, height: h, time: t, active, pulse, rhythm } = env;
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
        const angle = (p / 80) * TAU;
        const r = radius + Math.sin(angle * 5 + t * 0.035 + mark.spin) * (4 + rhythm * 0.55) * life;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r * (0.62 + pulse * 0.24);
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = life * 0.34;
    ctx.beginPath();
    ctx.moveTo(mark.px * w, mark.py * h);
    ctx.quadraticCurveTo(
      ((mark.px + mark.x) * 0.5) * w + Math.sin(t * 0.03 + index) * 24 * life,
      ((mark.py + mark.y) * 0.5) * h - Math.cos(t * 0.026 + index) * 18 * life,
      cx,
      cy,
    );
    ctx.stroke();
    ctx.restore();
  });
}

function drawGlyph(ctx, env) {
  const { width: w, height: h, time: t, active, state, pulse, rhythm } = env;
  const cx = w - Math.min(72, w * 0.16);
  const cy = Math.min(72, h * 0.16);
  const radius = Math.min(w, h) * 0.04;
  const spokes = state === 'rain' ? 5 : state === 'lightning' ? 3 : state === 'wind' ? 4 : 6;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.01 + rhythm * 0.015);
  ctx.strokeStyle = colorFor(state, 0.58);
  ctx.shadowColor = colorFor(state, 1);
  ctx.shadowBlur = 24;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < spokes; i += 1) {
    const angle = (i / spokes) * TAU + Math.sin(t * 0.025 + i) * 0.08;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.35, Math.sin(angle) * radius * 0.35);
    ctx.lineTo(Math.cos(angle) * radius * (1.15 + pulse * 0.5), Math.sin(angle) * radius * (1.15 + pulse * 0.5));
    ctx.stroke();
  }
  if (active.length) {
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.5 + pulse * 0.8), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVisualScore(ctx, env) {
  const { width: w, height: h, time: t, active, state, pulse, rhythm, budget } = env;
  if (!active.length) return;
  const score = active.slice(-(budget.mobile ? 6 : 9));
  const baseY = h * 0.78;
  const span = Math.min(w * 0.72, 420);
  const startX = (w - span) * 0.5;
  const stepX = span / Math.max(1, score.length - 1);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colorFor(state, 0.12 + pulse * 0.18);
  ctx.lineWidth = 1;
  for (let line = -1; line <= 1; line += 1) {
    ctx.beginPath();
    ctx.moveTo(startX - 8, baseY + line * 12);
    ctx.lineTo(startX + span + 8, baseY + line * 12);
    ctx.stroke();
  }
  score.forEach((mark, index) => {
    const age = Math.min(1, (Date.now() - mark.time) / 7200);
    const life = 1 - age;
    const phrase = Math.sin(mark.x * 5 + mark.y * 7 + mark.spin);
    const x = startX + index * stepX;
    const y = baseY - phrase * 30 - rhythm * 1.2;
    const size = 3.5 + life * 6 + pulse * 5;
    ctx.globalAlpha = 0.16 + life * 0.45;
    ctx.strokeStyle = colorFor(mark.kind, 0.36 + life * 0.36);
    ctx.fillStyle = colorFor(mark.kind, 0.05 + life * 0.1);
    ctx.shadowColor = colorFor(mark.kind, 0.9);
    ctx.shadowBlur = 8 + life * 14;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 1.45, size, Math.sin(t * 0.012 + index) * 0.35, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (index > 0) {
      const prev = score[index - 1];
      const prevPhrase = Math.sin(prev.x * 5 + prev.y * 7 + prev.spin);
      ctx.globalAlpha = 0.1 + life * 0.24;
      ctx.beginPath();
      ctx.moveTo(x - stepX, baseY - prevPhrase * 30 - rhythm * 1.2);
      ctx.quadraticCurveTo(x - stepX * 0.5, baseY - (prevPhrase + phrase) * 15 - Math.sin(t * 0.02) * 8, x, y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function useWordlessSky(state, pulse, marks, rhythm) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf = 0;
    let frame = 0;
    const stars = seed(180, (i) => ({ i, x: Math.random(), y: Math.random(), r: 0.35 + Math.random() * 1.8, s: 0.3 + Math.random() * 1.7 }));
    const motes = seed(68, (i) => ({ i, x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 2.2, p: Math.random() * TAU, s: 0.4 + Math.random() * 1.9 }));
    const veins = seed(18, (i) => ({ i, y: 0.08 + Math.random() * 0.76, p: Math.random() * TAU, a: 18 + Math.random() * 72 }));
    const rain = seed(150, (i) => ({ i, x: Math.random(), y: Math.random(), l: 16 + Math.random() * 54, s: 5 + Math.random() * 13 }));
    const ecology = createCreatureWeather();
    const comets = createGestureComets();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(PERFORMANCE_BUDGET.maxPixelRatio, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const loop = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const budget = responsiveBudget(width, height);
      const spec = skyState(state);
      const active = safeMarks(marks).slice(-(budget.mobile ? 12 : 20));
      const env = { width, height, time: frame, active, budget, state, pulse, rhythm, now: Date.now() };

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, spec.sky[0]);
      sky.addColorStop(0.5, spec.sky[1]);
      sky.addColorStop(1, spec.sky[2]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      drawGlow(ctx, width * 0.22, height * 0.18, width * 0.48, state === 'rain' ? 'rain' : 'clear', state === 'clear' ? 0.28 : 0.11);
      drawGlow(ctx, width * 0.82, height * 0.16, width * 0.42, state === 'murmur' ? 'murmur' : state === 'aurora' ? 'aurora' : 'dawn', 0.1 + pulse * 0.1);
      if (state === 'dawn') drawGlow(ctx, width * 0.5, height * 1.03, width * 0.7, 'dawn', 0.42);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      stars.slice(0, Math.min(stars.length, budget.stars || stars.length)).forEach((star) => {
        ctx.globalAlpha = Math.max(0, 0.12 + Math.sin(frame * 0.022 * star.s + star.i) * 0.13 + (state === 'clear' ? 0.22 : 0));
        ctx.fillStyle = '#fff8ef';
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height * 0.76, star.r, 0, TAU);
        ctx.fill();
      });
      veins.slice(0, budget.mobile ? 7 : veins.length).forEach((vein) => {
        const pull = active.reduce((sum, mark) => sum + Math.sin(mark.x * 8 + mark.y * 5 + vein.i) * 0.18, 0);
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, colorFor(state, 0));
        gradient.addColorStop(0.5, colorFor(state, 0.09 + pulse * 0.12));
        gradient.addColorStop(1, colorFor(state, 0));
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = state === 'wind' || state === 'murmur' || state === 'aurora' ? 0.76 : 0.32;
        ctx.lineWidth = 1 + pulse * 3;
        ctx.beginPath();
        for (let x = -60; x <= width + 60; x += 18) {
          const y = height * vein.y + Math.sin(x * 0.01 + frame * 0.018 + vein.p + pull) * (vein.a + pulse * 46);
          if (x === -60) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      motes.slice(0, Math.min(motes.length, budget.pollen || motes.length)).forEach((mote) => {
        const drift = state === 'wind' || state === 'murmur' ? 2.9 : 1.05;
        const x = ((mote.x * width + frame * mote.s * drift) % (width + 90)) - 45;
        const y = mote.y * height + Math.sin(frame * 0.018 + mote.p) * 20;
        ctx.globalAlpha = 0.07 + pulse * 0.2;
        ctx.fillStyle = colorFor(state, 0.62);
        ctx.beginPath();
        ctx.arc(x, y, mote.r, 0, TAU);
        ctx.fill();
      });
      ctx.restore();

      drawCreatureWeather(ctx, ecology, env);
      drawGestureComets(ctx, comets, env);
      drawMemory(ctx, env);

      if (state === 'rain') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = colorFor('rain', 0.5 + pulse * 0.22);
        ctx.lineWidth = 1;
        rain.slice(0, Math.min(rain.length, budget.rainDrops || rain.length)).forEach((drop) => {
          const y = ((drop.y * height + frame * drop.s * (1 + rhythm * 0.03)) % (height + 90)) - 70;
          const x = drop.x * width + Math.sin(frame * 0.011 + drop.i) * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 8, y + drop.l);
          ctx.stroke();
        });
        ctx.restore();
      }

      if (state === 'lightning' && (Math.sin(frame * 0.12) > 0.72 || pulse > 0.82)) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = colorFor('lightning', 0.14 + pulse * 0.08);
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = colorFor('lightning', 0.82);
        ctx.shadowColor = colorFor('lightning', 1);
        ctx.shadowBlur = 32;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        let x = width * (0.25 + Math.sin(frame * 0.021) * 0.16);
        let y = 0;
        ctx.moveTo(x, y);
        for (let i = 0; i < 9; i += 1) {
          x += Math.sin(frame * 0.07 + i * 2.4) * 42;
          y += height * 0.07 + Math.abs(Math.sin(frame * 0.033 + i)) * 28;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      drawVisualScore(ctx, env);
      drawHeart(ctx, env, spec);
      drawGlyph(ctx, env);
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
  const musicRef = useRef(null);
  const clockRef = useRef(null);
  const canvasRef = useWordlessSky(state, pulse, marks, rhythm);

  useEffect(() => {
    clockRef.current = createCompositionClock();
    musicRef.current = createSkyMusic();
    return () => musicRef.current?.stop?.();
  }, []);

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
      const cleaned = safeMarks(items);
      const prev = cleaned.at(-1) || null;
      return [...cleaned.slice(-PERFORMANCE_BUDGET.maxMarks), { ...point, prev, time: now, spin: Math.random() * TAU, kind: state }];
    });
    const gesture = evolveWeatherGesture({ now, lastTouch: lastTouch.current, rhythm, pulse, state, point });
    const nextPulse = Math.min(1, pulse + gesture.pulseBoost);
    const clock = clockRef.current?.tap?.({ now, state: gesture.kind, pulse: nextPulse, rhythm: gesture.rhythm }) ?? {
      beat: 0,
      phase: 0,
      phrase: 0,
      energy: nextPulse,
      state: gesture.kind,
    };
    const composition = {
      state: clock.state,
      pulse: clock.energy,
      rhythm: gesture.rhythm,
      beat: clock.beat,
      phase: clock.phase,
      phrase: clock.phrase,
    };
    lastTouch.current = now;
    setRhythm(gesture.rhythm);
    setState(gesture.kind);
    setPulse(nextPulse);
    musicRef.current?.start?.(composition);
    musicRef.current?.pulse?.(composition);
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

const css = `*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#050510}body{overflow:hidden;overscroll-behavior:none;touch-action:none}.wordless{min-height:100vh;color:transparent;background:#050510;-webkit-user-select:none;user-select:none}.sky{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#050510;cursor:crosshair;touch-action:none;-webkit-tap-highlight-color:transparent}.sky canvas{display:block;width:100%;height:100%}.orbit{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:10px;padding:11px 14px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(5,5,16,.34);backdrop-filter:blur(18px);box-shadow:0 18px 70px rgba(0,0,0,.34);pointer-events:none}.orbit i{width:9px;height:9px;border-radius:999px;background:rgba(255,255,255,.24);box-shadow:0 0 0 1px rgba(255,255,255,.12),0 0 18px rgba(255,255,255,.08);transition:transform .24s ease,background .24s ease,box-shadow .24s ease}.orbit i.on{background:#ffe2bf;box-shadow:0 0 24px #ffbe74,0 0 0 1px rgba(255,255,255,.58);transform:scale(1.52)}@media(max-width:700px){.orbit{bottom:max(14px,env(safe-area-inset-bottom));gap:8px;padding:10px 12px}.orbit i{width:8px;height:8px}}@media(prefers-reduced-motion:reduce){.orbit i{transition:none}}`;
