import React, { useEffect, useRef, useState } from 'react';
import {
  PERFORMANCE_BUDGET,
  SKY_STATES,
  evolveWeatherGesture,
  normalizePoint,
  responsiveBudget,
  skyState,
} from '../engine/skyState';
import { drawSkyFilaments, filamentBudget } from '../engine/filaments';
import { drawCreatureEcology, seedCreatures } from '../engine/creatureEcology';

const TAU = Math.PI * 2;

function seeds(n, map) {
  return Array.from({ length: n }, (_, i) => map(i));
}

function useSky(state, pulse, marks, rhythm) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let frame = 0;
    let raf = 0;
    const stars = seeds(PERFORMANCE_BUDGET.desktopStars, (i) => ({ i, x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.8, s: 0.1 + Math.random() * 1.8 }));
    const clouds = seeds(PERFORMANCE_BUDGET.desktopClouds, (i) => ({ i, x: Math.random(), y: 0.04 + Math.random() * 0.5, r: 36 + Math.random() * 112, a: 0.04 + Math.random() * 0.12 }));
    const rain = seeds(235, (i) => ({ i, x: Math.random(), y: Math.random(), l: 14 + Math.random() * 58, s: 4 + Math.random() * 11 }));
    const sprites = seeds(24, (i) => ({ i, x: Math.random(), y: Math.random(), a: Math.random() * TAU, s: 0.002 + Math.random() * 0.008, r: 12 + Math.random() * 46 }));
    const ribbons = seeds(9, (i) => ({ i, p: Math.random() * TAU, y: 0.12 + Math.random() * 0.72, a: 18 + Math.random() * 76, w: 2 + Math.random() * 8 }));
    const pollen = seeds(70, (i) => ({ i, x: Math.random(), y: Math.random(), s: 0.2 + Math.random() * 1.5, p: Math.random() * TAU }));
    const creatures = seedCreatures(PERFORMANCE_BUDGET.renderedCreatures);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const d = Math.min(PERFORMANCE_BUDGET.maxPixelRatio, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, r.width * d);
      canvas.height = Math.max(1, r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };

    const glow = (x, y, r, c, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c.replace('1)', `${a})`));
      g.addColorStop(1, c.replace('1)', '0)'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };

    const drawCloud = (x, y, s, a, warm) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = warm ? '#ffe2bf' : '#f7fbff';
      ctx.shadowColor = warm ? '#ffbe74' : '#b8e8ff';
      ctx.shadowBlur = 28;
      for (let i = 0; i < 9; i += 1) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i * 0.9) * s * 0.55, y + Math.sin(i * 1.7) * s * 0.23, s * (0.28 + (i % 5) * 0.075), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawRibbons = (w, h, t, spec) => {
      if (state !== 'wind' && state !== 'aurora' && state !== 'dawn' && state !== 'murmur' && pulse < 0.7) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ribbons.forEach((r) => {
        const pull = marks.slice(-6).reduce((sum, m) => sum + Math.sin(m.x * 8 + m.y * 5 + r.i), 0);
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, 'rgba(125,211,252,0)');
        g.addColorStop(0.35, state === 'wind' ? `rgba(255,226,191,${0.08 + pulse * 0.16})` : state === 'murmur' ? `rgba(196,181,253,${0.08 + pulse * 0.18})` : `rgba(134,239,172,${0.06 + pulse * 0.1})`);
        g.addColorStop(0.68, state === 'dawn' ? `rgba(255,154,118,${0.06 + pulse * 0.12})` : state === 'murmur' ? `rgba(167,243,208,${0.06 + pulse * 0.14})` : `rgba(240,171,252,${0.05 + pulse * 0.1})`);
        g.addColorStop(1, 'rgba(253,230,138,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = r.w + rhythm * spec.motion * 0.75;
        ctx.globalAlpha = state === 'wind' ? 0.82 : state === 'murmur' ? 0.66 : 0.45;
        ctx.beginPath();
        for (let x = -80; x <= w + 80; x += 16) {
          const y = h * r.y + Math.sin(x * 0.009 + t * 0.018 + r.p + pull * 0.1) * (r.a + pulse * 66);
          if (x === -80) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawMarks = (w, h, t) => {
      marks.slice(-PERFORMANCE_BUDGET.renderedMarks).forEach((m, i) => {
        const age = Math.min(1, (Date.now() - m.time) / 7600);
        const spec = skyState(m.kind);
        ctx.save();
        ctx.translate(m.x * w, m.y * h);
        ctx.rotate(m.spin + t * 0.006 + i * 0.08);
        ctx.globalAlpha = (1 - age) * 0.82;
        ctx.strokeStyle = spec.mark;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 26;
        const radius = 16 + age * (m.kind === 'wind' ? 220 : m.kind === 'murmur' ? 190 : 150) + i * 2.2;
        ctx.beginPath();
        for (let p = 0; p < 11; p += 1) {
          const a = (TAU * p) / 11;
          const rr = radius * (p % 2 ? 0.6 : 1);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        if (m.prev) {
          ctx.globalAlpha = (1 - age) * 0.42;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo((m.prev.x - m.x) * w, (m.prev.y - m.y) * h);
          ctx.stroke();
        }
        ctx.restore();
      });
    };

    const drawTethers = (w, h, t) => {
      const active = marks.slice(-PERFORMANCE_BUDGET.renderedTethers);
      if (!active.length) return;
      const anchorX = w * 0.5;
      const anchorY = h * 0.62;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      active.forEach((m, i) => {
        const age = Math.min(1, (Date.now() - m.time) / 9800);
        const fade = (1 - age) * (0.2 + pulse * 0.42);
        if (fade <= 0.01) return;
        const sx = m.x * w;
        const sy = m.y * h;
        const dx = anchorX - sx;
        const dy = anchorY - sy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / dist;
        const ny = dx / dist;
        const tug = Math.sin(t * 0.045 + i * 1.7 + rhythm * 0.35) * (18 + rhythm * 3.4 + pulse * 42);
        const slack = (m.kind === 'wind' ? 0.3 : m.kind === 'rain' ? -0.18 : m.kind === 'murmur' ? 0.2 : 0.08) * dist;
        const color = skyState(m.kind).tether;
        const gradient = ctx.createLinearGradient(sx, sy, anchorX, anchorY);
        gradient.addColorStop(0, `rgba(${color},0)`);
        gradient.addColorStop(0.22, `rgba(${color},${fade})`);
        gradient.addColorStop(0.7, `rgba(${color},${fade * 0.45})`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.1 + pulse * 2.2 + i * 0.22;
        ctx.shadowColor = `rgba(${color},1)`;
        ctx.shadowBlur = 14 + pulse * 26;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        for (let p = 1; p <= 9; p += 1) {
          const q = p / 10;
          const spring = Math.sin(q * Math.PI) * (tug + slack * 0.08);
          const wave = Math.sin(t * 0.026 + q * 9 + i) * Math.sin(q * Math.PI) * (6 + rhythm);
          const x = sx + dx * q + nx * (spring + wave);
          const y = sy + dy * q + ny * (spring + wave) + Math.sin(q * Math.PI) * slack * 0.05;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(anchorX, anchorY);
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawLightning = (w, h, t) => {
      if (state !== 'lightning') return;
      const on = Math.sin(t * 0.09) > 0.72 || pulse > 0.74;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.15;
      ctx.fillStyle = `rgba(225,242,255,${on ? 0.24 : 0.035})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = skyState('lightning').mark;
      ctx.lineWidth = 5;
      ctx.shadowColor = '#c7f7ff';
      ctx.shadowBlur = 34;
      for (let b = 0; b < 3; b += 1) {
        ctx.beginPath();
        let x = w * (0.13 + b * 0.28 + ((Math.sin(t * 0.013 + b) + 1) / 2) * 0.13);
        let y = 0;
        ctx.moveTo(x, y);
        for (let i = 0; i < 10; i += 1) {
          x += (Math.sin(t * 0.07 + i * 3.1 + b) - 0.33) * 52;
          y += h * 0.058 + Math.abs(Math.sin(t * 0.03 + i)) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawHeart = (cx, cy, t, spec) => {
      ctx.save();
      ctx.translate(cx, cy);
      const breath = 1 + Math.sin(t * 0.034) * 0.06 + pulse * 0.2 + (state === 'wind' || state === 'murmur' ? Math.sin(t * 0.08) * 0.04 : 0);
      ctx.scale(breath, breath);
      ctx.strokeStyle = spec.mark === '#91d8ff' ? '#ffe2bf' : spec.mark;
      ctx.lineWidth = 3;
      ctx.shadowColor = state === 'lightning' ? '#effbff' : state === 'dawn' ? '#ff7aa2' : state === 'murmur' ? '#c4b5fd' : '#ffbe74';
      ctx.shadowBlur = 38 + pulse * 76;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let a = 0; a <= TAU + 0.04; a += 0.04) {
        const r = 72 * (1 - Math.sin(a)) + 18 * Math.sin(a * 5 + t * 0.025 + rhythm * 0.2);
        const x = Math.sin(a) * r * 0.42;
        const y = Math.cos(a) * r * 0.34;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const loop = () => {
      frame += 1;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      const budget = responsiveBudget(w, h);
      const t = frame;
      const spec = skyState(state);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, spec.sky[0]);
      sky.addColorStop(0.48, spec.sky[1]);
      sky.addColorStop(1, spec.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      if (state === 'dawn') glow(w * 0.5, h * 1.03, w * 0.62, 'rgba(255,154,118,1)', 0.42);
      if (state === 'wind') glow(w * 0.5, h * 0.85, w * 0.52, 'rgba(255,226,191,1)', 0.22);
      if (state === 'murmur') glow(w * 0.5, h * 0.52, w * 0.48, 'rgba(196,181,253,1)', 0.18 + pulse * 0.1);
      glow(w * 0.18, h * 0.18, w * 0.42, 'rgba(125,211,252,1)', state === 'clear' ? 0.24 : 0.09);
      glow(w * 0.82, h * 0.14, w * 0.38, 'rgba(240,171,252,1)', state === 'lightning' || state === 'aurora' || state === 'murmur' ? 0.2 : 0.08);

      drawRibbons(w, h, t, spec);

      stars.slice(0, budget.stars).forEach((s) => {
        ctx.globalAlpha = 0.12 + Math.sin(t * 0.02 * s.s + s.i) * 0.13 + (state === 'clear' ? 0.2 : state === 'murmur' ? 0.1 : 0) - (state === 'dawn' ? 0.08 : 0);
        ctx.fillStyle = '#fff8ef';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.72, s.r, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      clouds.slice(0, budget.clouds).forEach((c) => {
        const drift = Math.sin(t * 0.006 + c.i) * (28 + rhythm * (state === 'wind' || state === 'murmur' ? 9 : 3));
        const alpha = state === 'clear' ? 0.08 : c.a * (state === 'cloud' ? 5 : state === 'murmur' ? 3.3 : 2.2);
        drawCloud(c.x * w + drift, c.y * h, c.r, alpha, pulse > 0.62 || spec.warmth > 0.7);
      });

      if (state === 'wind' || state === 'dawn' || state === 'murmur' || pulse > 0.66) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        pollen.forEach((d) => {
          const x = ((d.x * w + t * d.s * (state === 'wind' || state === 'murmur' ? 3.4 : 1.2)) % (w + 80)) - 40;
          const y = d.y * h + Math.sin(t * 0.018 + d.p) * 22;
          ctx.globalAlpha = 0.12 + pulse * 0.22;
          ctx.fillStyle = state === 'dawn' ? '#ffd1dc' : state === 'murmur' ? '#c4b5fd' : '#fff0c7';
          ctx.beginPath();
          ctx.arc(x, y, 0.8 + d.s * 1.2, 0, TAU);
          ctx.fill();
        });
        ctx.restore();
      }

      sprites.forEach((s) => {
        const x = s.x * w + Math.sin(t * s.s + s.i) * w * (0.05 + spec.motion * 0.12);
        const y = s.y * h * 0.78 + Math.cos(t * s.s * 1.5 + s.i) * h * 0.05;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.a + Math.sin(t * s.s) * 0.85);
        ctx.globalAlpha = 0.16 + pulse * 0.38;
        ctx.strokeStyle = state === 'rain' ? '#9cdcff' : state === 'murmur' ? '#c4b5fd' : spec.mark === '#91d8ff' ? '#fff8ef' : spec.mark;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 18 + pulse * 26;
        ctx.beginPath();
        for (let p = 0; p <= 92; p += 1) {
          const a = p * 0.18;
          const rr = s.r * (0.2 + p / 92);
          if (p === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.65); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.65);
        }
        ctx.stroke();
        ctx.restore();
      });

      drawCreatureEcology(ctx, creatures, marks, { width: w, height: h, time: t, pulse, rhythm, state, spec, budget });
      drawTethers(w, h, t);
      drawSkyFilaments(ctx, marks, {
        width: w,
        height: h,
        time: t,
        pulse,
        rhythm,
        state,
        skyState,
        budget: filamentBudget(w, PERFORMANCE_BUDGET),
      });
      drawMarks(w, h, t);

      if (state === 'rain') {
        ctx.save();
        ctx.strokeStyle = '#9cdcff';
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.35 + pulse * 0.33;
        rain.forEach((d) => {
          const y = ((d.y * h + t * d.s * (1 + rhythm * 0.035)) % (h + 90)) - 70;
          const x = d.x * w + Math.sin(t * 0.01 + d.i) * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 9, y + d.l);
          ctx.stroke();
        });
        ctx.restore();
      }

      drawLightning(w, h, t);
      drawHeart(w / 2, h * 0.62, t, spec);
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
  const [pulse, setPulse] = useState(0.48);
  const [marks, setMarks] = useState([]);
  const [rhythm, setRhythm] = useState(0);
  const lastTouch = useRef(0);
  const canvasRef = useSky(state, pulse, marks, rhythm);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulse((v) => Math.max(PERFORMANCE_BUDGET.pulseFloor, v * PERFORMANCE_BUDGET.pulseDecay));
      setRhythm((v) => Math.max(0, v - PERFORMANCE_BUDGET.rhythmDecay));
    }, PERFORMANCE_BUDGET.tickMs);
    return () => window.clearInterval(id);
  }, []);

  const touch = (event) => {
    const point = normalizePoint(event);
    const now = Date.now();
    const prev = marks.at(-1) || null;
    const gesture = evolveWeatherGesture({ now, lastTouch: lastTouch.current, rhythm, pulse, state, point });
    lastTouch.current = now;
    setRhythm(gesture.rhythm);
    setState(gesture.kind);
    setPulse((v) => Math.min(1, v + gesture.pulseBoost));
    setMarks((items) => [...items.slice(-PERFORMANCE_BUDGET.maxMarks), { ...point, prev, time: now, spin: Math.random() * TAU, kind: gesture.kind }]);
  };

  return <main className="wordless" aria-label="Wordless internal sky interface"><style>{css}</style><button className="sky" onClick={touch} aria-label="Change sky state"><canvas ref={canvasRef} /></button><div className="orbit" aria-hidden="true">{SKY_STATES.map((name) => <i key={name} className={name === state ? 'on' : ''} />)}</div><div className={`glyph glyph-${skyState(state).glyph}`} aria-hidden="true"><span /><span /><span /></div></main>;
}

const css = `*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#050510}body{overflow:hidden}.wordless{min-height:100vh;color:transparent}.sky{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#050510;cursor:crosshair}.sky canvas{display:block;width:100%;height:100%;touch-action:manipulation}.orbit{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:flex;gap:11px;padding:12px 15px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(5,5,16,.34);backdrop-filter:blur(20px);box-shadow:0 20px 80px rgba(0,0,0,.35)}.orbit i{width:10px;height:10px;border-radius:999px;background:rgba(255,255,255,.25);box-shadow:0 0 0 1px rgba(255,255,255,.12);transition:.22s}.orbit i.on{background:#ffe2bf;box-shadow:0 0 22px #ffbe74,0 0 0 1px rgba(255,255,255,.56);transform:scale(1.46)}.glyph{position:fixed;right:28px;top:28px;width:76px;height:76px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.055);backdrop-filter:blur(18px);box-shadow:0 18px 80px rgba(0,0,0,.28);pointer-events:none}.glyph span{position:absolute;left:50%;top:50%;width:42px;height:2px;transform-origin:left center;border-radius:999px;background:#fff8ef;box-shadow:0 0 18px currentColor}.glyph span:nth-child(1){transform:rotate(0deg) translateX(-16px)}.glyph span:nth-child(2){transform:rotate(120deg) translateX(-16px)}.glyph span:nth-child(3){transform:rotate(240deg) translateX(-16px)}.glyph-cloud{color:#f7fbff}.glyph-rain{color:#91d8ff}.glyph-rain span{height:22px;width:2px}.glyph-lightning{color:#effbff;animation:strike .8s steps(2,end) infinite}.glyph-clear{color:#ffe2bf}.glyph-clear span:nth-child(2){transform:rotate(90deg) translateX(-17px)}.glyph-clear span:nth-child(3){width:52px;height:52px;border:2px solid #ffe2bf;background:transparent;border-radius:50%;transform:translate(-50%,-50%)}.glyph-aurora{color:#a7f3d0}.glyph-aurora span:nth-child(3){width:46px;height:22px;border:2px solid #a7f3d0;background:transparent;border-radius:999px;transform:translate(-50%,-50%) rotate(-18deg)}.glyph-dawn{color:#ffd1dc;animation:rise 2.2s ease-in-out infinite}.glyph-dawn span:nth-child(3){width:48px;height:48px;border:2px solid #ffd1dc;background:transparent;border-radius:50%;transform:translate(-50%,-50%)}.glyph-wind{color:#fff0c7;animation:rise 1.6s ease-in-out infinite}.glyph-wind span:nth-child(1){width:50px;transform:rotate(8deg) translateX(-22px)}.glyph-wind span:nth-child(2){width:38px;transform:rotate(-8deg) translateX(-14px) translateY(10px)}.glyph-wind span:nth-child(3){width:28px;transform:rotate(18deg) translateX(-4px) translateY(-12px)}@keyframes strike{0%,60%,100%{filter:brightness(1)}61%,72%{filter:brightness(2.8)}}@keyframes rise{50%{filter:brightness(1.9);transform:translateY(-3px)}}@media(max-width:700px){.glyph{right:16px;top:16px;width:58px;height:58px}.orbit{bottom:18px;gap:9px;padding:10px 12px}.orbit i{width:9px;height:9px}}`;
