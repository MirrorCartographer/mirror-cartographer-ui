import React, { useEffect, useMemo, useRef, useState } from 'react';

const STATES = ['cloud', 'rain', 'lightning', 'clear', 'aurora', 'dawn'];

function chooseState(current, x, y, pulse, rhythm) {
  if (rhythm > 6 && pulse > 0.78) return 'dawn';
  if (pulse > 0.82 && rhythm > 4) return 'lightning';
  if (y > 0.7) return 'rain';
  if (x < 0.25) return 'cloud';
  if (x > 0.75) return 'aurora';
  if (y < 0.22) return 'clear';
  const index = STATES.indexOf(current);
  return STATES[(index + 1) % STATES.length];
}

function useSkyCanvas(state, pulse, marks, rhythm) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let frame = 0;

    const stars = Array.from({ length: 190 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), r: 0.45 + Math.random() * 1.9, s: 0.16 + Math.random() * 1.7 }));
    const clouds = Array.from({ length: 38 }, (_, i) => ({ i, x: Math.random(), y: 0.04 + Math.random() * 0.48, r: 38 + Math.random() * 106, a: 0.04 + Math.random() * 0.12 }));
    const rain = Array.from({ length: 220 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), l: 16 + Math.random() * 52, s: 4 + Math.random() * 10 }));
    const sprites = Array.from({ length: 18 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), a: Math.random() * Math.PI * 2, s: 0.003 + Math.random() * 0.008, r: 16 + Math.random() * 44 }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = Math.max(1, rect.height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const rgba = (rgb, alpha) => rgb.replace(')', `, ${alpha})`).replace('rgb', 'rgba');

    const glow = (x, y, radius, color, alpha) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const cloud = (x, y, s, a, warm) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = warm ? '#ffe2bf' : '#f7fbff';
      ctx.shadowColor = warm ? '#ffbe74' : '#b8e8ff';
      ctx.shadowBlur = 28;
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i) * s * 0.55, y + Math.sin(i * 1.7) * s * 0.22, s * (0.36 + (i % 4) * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const aurora = (w, h, t) => {
      if (state !== 'aurora' && state !== 'dawn' && pulse < 0.72) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let ribbon = 0; ribbon < 6; ribbon += 1) {
        const g = ctx.createLinearGradient(0, h * 0.12, w, h * 0.72);
        g.addColorStop(0, 'rgba(125,211,252,0)');
        g.addColorStop(0.28, `rgba(134,239,172,${0.08 + pulse * 0.12})`);
        g.addColorStop(0.62, `rgba(240,171,252,${0.07 + pulse * 0.11})`);
        g.addColorStop(1, 'rgba(253,230,138,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 16 + ribbon * 8;
        ctx.globalAlpha = state === 'aurora' || state === 'dawn' ? 0.78 : 0.34;
        ctx.beginPath();
        for (let x = -60; x <= w + 60; x += 20) {
          const y = h * (0.18 + ribbon * 0.07) + Math.sin(x * 0.008 + t * 0.018 + ribbon) * (36 + pulse * 78);
          if (x === -60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const lightning = (w, h, t) => {
      if (state !== 'lightning') return;
      const intensity = Math.sin(t * 0.09) > 0.72 || pulse > 0.74 ? 1 : 0.15;
      ctx.save();
      ctx.globalAlpha = intensity;
      ctx.fillStyle = `rgba(225,242,255,${0.24 * intensity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#effbff';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#c7f7ff';
      ctx.shadowBlur = 30;
      for (let bolt = 0; bolt < 2; bolt += 1) {
        ctx.beginPath();
        let x = w * (0.2 + bolt * 0.34 + ((Math.sin(t * 0.013 + bolt) + 1) / 2) * 0.18);
        let y = 0;
        ctx.moveTo(x, y);
        for (let i = 0; i < 9; i += 1) {
          x += (Math.sin(t * 0.07 + i * 3.1 + bolt) - 0.33) * 54;
          y += h * 0.066 + Math.abs(Math.sin(t * 0.03 + i)) * 42;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawHeart = (cx, cy, t, w) => {
      ctx.save();
      ctx.translate(cx, cy);
      const breath = 1 + Math.sin(t * 0.034) * 0.06 + pulse * 0.22;
      ctx.scale(breath, breath);
      ctx.strokeStyle = state === 'aurora' ? '#c7ffd7' : state === 'dawn' ? '#ffd1dc' : '#ffe2bf';
      ctx.lineWidth = 3;
      ctx.shadowColor = state === 'lightning' ? '#effbff' : state === 'dawn' ? '#ff7aa2' : '#ffbe74';
      ctx.shadowBlur = 38 + pulse * 76;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.04; a += 0.04) {
        const r = 72 * (1 - Math.sin(a)) + 20 * Math.sin(a * 5 + t * 0.025 + rhythm * 0.2);
        const x = Math.sin(a) * r * 0.42;
        const y = Math.cos(a) * r * 0.34;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.2 + pulse * 0.26;
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, w * (0.045 + ring * 0.026 + pulse * 0.024), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSprite = (sprite, w, h, t) => {
      const x = sprite.x * w + Math.sin(t * sprite.s + sprite.i) * w * 0.07;
      const y = sprite.y * h * 0.78 + Math.cos(t * sprite.s * 1.5 + sprite.i) * h * 0.045;
      const nearest = marks.slice(-8).reduce((best, mark) => {
        const dx = mark.x * w - x;
        const dy = mark.y * h - y;
        return Math.min(best, Math.sqrt(dx * dx + dy * dy));
      }, Infinity);
      const awake = Math.max(0, 1 - nearest / Math.max(w, h) * 2.7) + pulse * 0.28 + (state === 'dawn' ? 0.35 : 0);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sprite.a + Math.sin(t * sprite.s) * 0.85);
      ctx.globalAlpha = 0.12 + awake * 0.44;
      ctx.strokeStyle = state === 'rain' ? '#9cdcff' : state === 'aurora' ? '#a7f3d0' : state === 'dawn' ? '#ffd1dc' : '#fff8ef';
      ctx.lineWidth = 1.35;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 12 + awake * 30;
      ctx.beginPath();
      for (let p = 0; p <= 90; p += 1) {
        const a = p * 0.18;
        const r = sprite.r * (0.2 + p / 90) * (1 + Math.sin(a * 2 + t * 0.02) * 0.08);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.65;
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    };

    const loop = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const t = frame;
      const cx = w / 2;
      const cy = h * 0.62;

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, state === 'lightning' ? '#17213f' : state === 'aurora' ? '#071827' : state === 'dawn' ? '#241738' : '#060718');
      sky.addColorStop(0.45, state === 'rain' ? '#152030' : state === 'dawn' ? '#5c2845' : '#10162b');
      sky.addColorStop(1, state === 'clear' ? '#3b2434' : state === 'dawn' ? '#ff9a76' : '#07070d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      if (state === 'dawn') {
        glow(w * 0.5, h * 1.03, w * 0.62, 'rgb(255,154,118)', 0.42);
        glow(w * 0.5, h * 0.82, w * 0.36, 'rgb(255,209,220)', 0.24);
      }
      glow(w * 0.18, h * 0.18, w * 0.42, 'rgb(125,211,252)', state === 'clear' ? 0.24 : 0.09);
      glow(w * 0.82, h * 0.14, w * 0.38, 'rgb(240,171,252)', state === 'lightning' || state === 'aurora' ? 0.2 : 0.08);
      glow(cx, cy, w * (0.14 + pulse * 0.14), 'rgb(255,226,191)', 0.12 + pulse * 0.38);
      aurora(w, h, t);

      stars.forEach((star) => {
        ctx.globalAlpha = 0.14 + Math.sin(t * 0.02 * star.s + star.i) * 0.13 + (state === 'clear' ? 0.18 : 0) - (state === 'dawn' ? 0.08 : 0);
        ctx.fillStyle = '#fff8ef';
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h * 0.72, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      clouds.forEach((c) => {
        const drift = Math.sin(t * 0.006 + c.i) * (28 + rhythm * 3);
        const visible = state === 'clear' ? 0.08 : state === 'cloud' ? c.a * 5.0 : state === 'aurora' ? c.a * 1.5 : state === 'dawn' ? c.a * 2.1 : c.a * 2.8;
        cloud(c.x * w + drift, c.y * h, c.r, visible, pulse > 0.62 || state === 'dawn');
      });

      sprites.forEach((sprite) => drawSprite(sprite, w, h, t));

      marks.slice(-18).forEach((mark, i) => {
        const age = Math.min(1, (Date.now() - mark.time) / 6800);
        const alpha = 1 - age;
        ctx.save();
        ctx.translate(mark.x * w, mark.y * h);
        ctx.rotate(mark.spin + t * 0.006);
        ctx.globalAlpha = alpha * 0.84;
        ctx.strokeStyle = mark.kind === 'lightning' ? '#effbff' : mark.kind === 'rain' ? '#91d8ff' : mark.kind === 'aurora' ? '#a7f3d0' : mark.kind === 'dawn' ? '#ffd1dc' : '#ffe2bf';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 26;
        const radius = 18 + age * 142 + i * 2.5;
        ctx.beginPath();
        for (let p = 0; p < 9; p += 1) {
          const a = (Math.PI * 2 * p) / 9;
          const rr = radius * (p % 2 ? 0.68 : 1);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      });

      if (state === 'rain') {
        ctx.save();
        ctx.strokeStyle = '#9cdcff';
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.35 + pulse * 0.33;
        rain.forEach((drop) => {
          const y = ((drop.y * h + t * drop.s * (1 + rhythm * 0.035)) % (h + 90)) - 70;
          const x = drop.x * w + Math.sin(t * 0.01 + drop.i) * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 9, y + drop.l);
          ctx.stroke();
        });
        ctx.restore();
      }

      lightning(w, h, t);
      drawHeart(cx, cy, t, w);
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
  const canvasRef = useSkyCanvas(state, pulse, marks, rhythm);
  const stateIndex = useMemo(() => STATES.indexOf(state), [state]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulse((value) => Math.max(0.18, value * 0.984));
      setRhythm((value) => Math.max(0, value - 0.12));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  const touch = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = 'clientX' in event ? event.clientX : rect.left + rect.width / 2;
    const y = 'clientY' in event ? event.clientY : rect.top + rect.height / 2;
    const nx = (x - rect.left) / rect.width;
    const ny = (y - rect.top) / rect.height;
    const now = Date.now();
    const close = now - lastTouch.current < 620;
    lastTouch.current = now;
    const nextRhythm = close ? rhythm + 1 : Math.max(1, rhythm * 0.4);
    const next = chooseState(state, nx, ny, pulse, nextRhythm);
    setRhythm(Math.min(9, nextRhythm));
    setState(next);
    setPulse((value) => Math.min(1, value + (close ? 0.34 : 0.24)));
    setMarks((items) => [...items.slice(-22), { x: nx, y: ny, time: now, spin: Math.random() * Math.PI, kind: next }]);
  };

  return (
    <main className="wordless" aria-label="Wordless internal sky interface">
      <style>{css}</style>
      <button className="sky" onClick={touch} aria-label="Change sky state"><canvas ref={canvasRef} /></button>
      <div className="orbit" aria-hidden="true">{STATES.map((name, index) => <i key={name} className={index === stateIndex ? 'on' : ''} />)}</div>
      <div className={`glyph glyph-${state}`} aria-hidden="true"><span /><span /><span /></div>
    </main>
  );
}

const css = `
*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#050510}body{overflow:hidden}.wordless{min-height:100vh;position:relative;background:#050510;color:transparent}.sky{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#050510;cursor:crosshair;display:block}.sky canvas{display:block;width:100%;height:100%;touch-action:manipulation}.orbit{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:flex;gap:12px;padding:12px 15px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(5,5,16,.34);backdrop-filter:blur(20px);box-shadow:0 20px 80px rgba(0,0,0,.35)}.orbit i{width:11px;height:11px;border-radius:999px;background:rgba(255,255,255,.25);box-shadow:0 0 0 1px rgba(255,255,255,.12);transition:transform .22s ease,background .22s ease}.orbit i.on{background:#ffe2bf;box-shadow:0 0 22px #ffbe74,0 0 0 1px rgba(255,255,255,.56);transform:scale(1.46)}.glyph{position:fixed;right:28px;top:28px;width:76px;height:76px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.055);backdrop-filter:blur(18px);box-shadow:0 18px 80px rgba(0,0,0,.28);pointer-events:none}.glyph span{position:absolute;left:50%;top:50%;width:42px;height:2px;transform-origin:left center;border-radius:999px;background:#fff8ef;box-shadow:0 0 18px currentColor}.glyph span:nth-child(1){transform:rotate(0deg) translateX(-16px)}.glyph span:nth-child(2){transform:rotate(120deg) translateX(-16px)}.glyph span:nth-child(3){transform:rotate(240deg) translateX(-16px)}.glyph-cloud{color:#f7fbff}.glyph-rain{color:#91d8ff}.glyph-rain span{height:22px;width:2px}.glyph-lightning{color:#effbff;animation:strike .8s steps(2,end) infinite}.glyph-lightning span:nth-child(1){transform:rotate(102deg) translateX(-14px);width:52px}.glyph-lightning span:nth-child(2){transform:rotate(72deg) translateX(-2px);width:34px}.glyph-lightning span:nth-child(3){transform:rotate(130deg) translateX(-4px);width:28px}.glyph-clear{color:#ffe2bf}.glyph-clear span{width:34px}.glyph-clear span:nth-child(1){transform:rotate(0deg) translateX(-17px)}.glyph-clear span:nth-child(2){transform:rotate(90deg) translateX(-17px)}.glyph-clear span:nth-child(3){width:52px;height:52px;border:2px solid #ffe2bf;background:transparent;border-radius:50%;transform:translate(-50%,-50%)}.glyph-aurora{color:#a7f3d0}.glyph-aurora span:nth-child(1){transform:rotate(22deg) translateX(-19px);width:48px}.glyph-aurora span:nth-child(2){transform:rotate(142deg) translateX(-19px);width:48px}.glyph-aurora span:nth-child(3){width:46px;height:22px;border:2px solid #a7f3d0;background:transparent;border-radius:999px;transform:translate(-50%,-50%) rotate(-18deg)}.glyph-dawn{color:#ffd1dc;animation:rise 2.2s ease-in-out infinite}.glyph-dawn span:nth-child(1){transform:rotate(0deg) translateX(-18px);width:42px}.glyph-dawn span:nth-child(2){transform:rotate(90deg) translateX(-18px);width:42px}.glyph-dawn span:nth-child(3){width:48px;height:48px;border:2px solid #ffd1dc;background:transparent;border-radius:50%;transform:translate(-50%,-50%)}@keyframes strike{0%,60%,100%{filter:brightness(1)}61%,72%{filter:brightness(2.8)}}@keyframes rise{50%{filter:brightness(1.9);transform:translateY(-3px)}}@media(max-width:700px){.glyph{right:16px;top:16px;width:58px;height:58px}.orbit{bottom:18px;gap:10px}.orbit i{width:10px;height:10px}}
`;
