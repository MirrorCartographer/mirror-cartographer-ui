import React, { useEffect, useMemo, useRef, useState } from 'react';

const STATES = ['cloud', 'rain', 'lightning', 'clear'];

function nextState(current) {
  const index = STATES.indexOf(current);
  return STATES[(index + 1) % STATES.length];
}

function useSkyCanvas(state, pulse, marks) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let frame = 0;
    const stars = Array.from({ length: 140 }, (_, i) => ({
      i,
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.8,
      s: 0.2 + Math.random() * 1.4
    }));
    const cloudSeeds = Array.from({ length: 30 }, (_, i) => ({
      i,
      x: Math.random(),
      y: 0.08 + Math.random() * 0.42,
      r: 44 + Math.random() * 90,
      a: 0.04 + Math.random() * 0.11
    }));
    const rainSeeds = Array.from({ length: 160 }, (_, i) => ({
      i,
      x: Math.random(),
      y: Math.random(),
      l: 18 + Math.random() * 42,
      s: 4 + Math.random() * 8
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = Math.max(1, rect.height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const glow = (x, y, radius, color, alpha) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
      g.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawCloud = (x, y, s, a, warm = false) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = warm ? '#ffe2bf' : '#f7fbff';
      ctx.shadowColor = warm ? '#ffbe74' : '#b8e8ff';
      ctx.shadowBlur = 28;
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(i) * s * 0.55, y + Math.sin(i * 1.7) * s * 0.2, s * (0.42 + (i % 3) * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawLightning = (w, h, t) => {
      const flashes = state === 'lightning' ? 1 : 0;
      if (!flashes) return;
      const intensity = (Math.sin(t * 0.09) > 0.72 || pulse > 0.74) ? 1 : 0.18;
      ctx.save();
      ctx.globalAlpha = intensity;
      ctx.fillStyle = `rgba(225,242,255,${0.22 * intensity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#effbff';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#c7f7ff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      let x = w * (0.22 + ((Math.sin(t * 0.013) + 1) / 2) * 0.56);
      let y = 0;
      ctx.moveTo(x, y);
      for (let i = 0; i < 9; i += 1) {
        x += (Math.random() - 0.44) * 68;
        y += h * 0.07 + Math.random() * 40;
        ctx.lineTo(x, y);
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
      sky.addColorStop(0, state === 'lightning' ? '#17213f' : '#060718');
      sky.addColorStop(0.42, state === 'rain' ? '#152030' : '#10162b');
      sky.addColorStop(1, state === 'clear' ? '#3b2434' : '#07070d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      glow(w * 0.18, h * 0.18, w * 0.42, 'rgb(125,211,252)', state === 'clear' ? 0.24 : 0.09);
      glow(w * 0.82, h * 0.14, w * 0.38, 'rgb(240,171,252)', state === 'lightning' ? 0.19 : 0.08);
      glow(cx, cy, w * (0.15 + pulse * 0.13), 'rgb(255,226,191)', 0.13 + pulse * 0.35);

      stars.forEach((star) => {
        ctx.globalAlpha = 0.18 + Math.sin(t * 0.02 * star.s + star.i) * 0.14;
        ctx.fillStyle = '#fff8ef';
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h * 0.72, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      cloudSeeds.forEach((cloud) => {
        const drift = Math.sin(t * 0.006 + cloud.i) * 30;
        const visible = state === 'clear' ? 0.08 : state === 'cloud' ? cloud.a * 4.7 : cloud.a * 2.8;
        drawCloud(cloud.x * w + drift, cloud.y * h, cloud.r, visible, pulse > 0.62);
      });

      marks.slice(-9).forEach((mark, i) => {
        const age = Math.min(1, (Date.now() - mark.time) / 4200);
        const alpha = 1 - age;
        ctx.save();
        ctx.translate(mark.x * w, mark.y * h);
        ctx.rotate(mark.spin + t * 0.006);
        ctx.globalAlpha = alpha * 0.82;
        ctx.strokeStyle = mark.kind === 'lightning' ? '#effbff' : mark.kind === 'rain' ? '#91d8ff' : '#ffe2bf';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 24;
        const radius = 18 + age * 110 + i * 3;
        ctx.beginPath();
        for (let p = 0; p < 7; p += 1) {
          const a = (Math.PI * 2 * p) / 7;
          const rr = radius * (p % 2 ? 0.72 : 1);
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
        ctx.globalAlpha = 0.34 + pulse * 0.3;
        rainSeeds.forEach((drop) => {
          const y = ((drop.y * h + t * drop.s) % (h + 90)) - 70;
          const x = drop.x * w + Math.sin(t * 0.01 + drop.i) * 18;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 9, y + drop.l);
          ctx.stroke();
        });
        ctx.restore();
      }

      drawLightning(w, h, t);

      ctx.save();
      ctx.translate(cx, cy);
      const breath = 1 + Math.sin(t * 0.035) * 0.055 + pulse * 0.2;
      ctx.scale(breath, breath);
      ctx.strokeStyle = '#ffe2bf';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffbe74';
      ctx.shadowBlur = 35 + pulse * 60;
      ctx.globalAlpha = 0.86;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.04; a += 0.04) {
        const r = 72 * (1 - Math.sin(a)) + 18 * Math.sin(a * 5 + t * 0.025);
        const x = Math.sin(a) * r * 0.42;
        const y = Math.cos(a) * r * 0.34;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };

    resize();
    loop();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [state, pulse, marks]);

  return ref;
}

export default function App() {
  const [state, setState] = useState('cloud');
  const [pulse, setPulse] = useState(0.48);
  const [marks, setMarks] = useState([]);
  const canvasRef = useSkyCanvas(state, pulse, marks);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPulse((value) => Math.max(0.18, value * 0.985));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  const stateIndex = useMemo(() => STATES.indexOf(state), [state]);

  const touch = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = 'clientX' in event ? event.clientX : rect.left + rect.width / 2;
    const y = 'clientY' in event ? event.clientY : rect.top + rect.height / 2;
    const next = nextState(state);
    setState(next);
    setPulse((value) => Math.min(1, value + 0.28));
    setMarks((items) => [
      ...items.slice(-12),
      {
        x: (x - rect.left) / rect.width,
        y: (y - rect.top) / rect.height,
        time: Date.now(),
        spin: Math.random() * Math.PI,
        kind: next
      }
    ]);
  };

  return (
    <main className="wordless" aria-label="Wordless internal sky interface">
      <style>{css}</style>
      <button className="sky" onClick={touch} aria-label="Change sky state">
        <canvas ref={canvasRef} />
      </button>
      <div className="orbit" aria-hidden="true">
        {STATES.map((name, index) => (
          <i key={name} className={index === stateIndex ? 'on' : ''} />
        ))}
      </div>
      <div className={`glyph glyph-${state}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

const css = `
*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#050510}body{overflow:hidden}.wordless{min-height:100vh;position:relative;background:#050510;color:transparent}.sky{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#050510;cursor:crosshair;display:block}.sky canvas{display:block;width:100%;height:100%;touch-action:manipulation}.orbit{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:flex;gap:13px;padding:12px 15px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(5,5,16,.34);backdrop-filter:blur(20px);box-shadow:0 20px 80px rgba(0,0,0,.35)}.orbit i{width:12px;height:12px;border-radius:999px;background:rgba(255,255,255,.26);box-shadow:0 0 0 1px rgba(255,255,255,.12)}.orbit i.on{background:#ffe2bf;box-shadow:0 0 22px #ffbe74,0 0 0 1px rgba(255,255,255,.56)}.glyph{position:fixed;right:28px;top:28px;width:76px;height:76px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.055);backdrop-filter:blur(18px);box-shadow:0 18px 80px rgba(0,0,0,.28);pointer-events:none}.glyph span{position:absolute;left:50%;top:50%;width:42px;height:2px;transform-origin:left center;border-radius:999px;background:#fff8ef;box-shadow:0 0 18px currentColor}.glyph span:nth-child(1){transform:rotate(0deg) translateX(-16px)}.glyph span:nth-child(2){transform:rotate(120deg) translateX(-16px)}.glyph span:nth-child(3){transform:rotate(240deg) translateX(-16px)}.glyph-cloud{color:#f7fbff}.glyph-rain{color:#91d8ff}.glyph-rain span{height:22px;width:2px}.glyph-lightning{color:#effbff;animation:strike .8s steps(2,end) infinite}.glyph-lightning span:nth-child(1){transform:rotate(102deg) translateX(-14px);width:52px}.glyph-lightning span:nth-child(2){transform:rotate(72deg) translateX(-2px);width:34px}.glyph-lightning span:nth-child(3){transform:rotate(130deg) translateX(-4px);width:28px}.glyph-clear{color:#ffe2bf}.glyph-clear span{width:34px}.glyph-clear span:nth-child(1){transform:rotate(0deg) translateX(-17px)}.glyph-clear span:nth-child(2){transform:rotate(90deg) translateX(-17px)}.glyph-clear span:nth-child(3){width:52px;height:52px;border:2px solid #ffe2bf;background:transparent;border-radius:50%;transform:translate(-50%,-50%)}@keyframes strike{0%,60%,100%{filter:brightness(1)}61%,72%{filter:brightness(2.8)}}@media(max-width:700px){.glyph{right:16px;top:16px;width:58px;height:58px}.orbit{bottom:18px}.orbit i{width:10px;height:10px}}
`;
