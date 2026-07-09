import React, { useEffect, useRef, useState } from 'react';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => min + Math.random() * (max - min);

const LAYERS = [
  { name: 'SENSORY FIELD', count: 9, x: 0.11, hue: '255,226,191' },
  { name: 'SYMBOL MAP', count: 12, x: 0.30, hue: '196,181,253' },
  { name: 'CONTEXT GATES', count: 7, x: 0.50, hue: '145,216,255' },
  { name: 'INFERENCE CORE', count: 11, x: 0.70, hue: '167,243,208' },
  { name: 'OUTPUT STATE', count: 6, x: 0.89, hue: '255,209,220' },
];

const CAPTIONS = [
  'touch injects signal',
  'attention chooses a path',
  'context gates open / close',
  'memory leaves luminous residue',
  'output changes the field',
];

function makeNetwork() {
  const nodes = [];
  const links = [];

  LAYERS.forEach((layer, layerIndex) => {
    const span = 0.74;
    const start = 0.13;
    for (let i = 0; i < layer.count; i += 1) {
      const y = start + (span * (i + 0.5)) / layer.count;
      nodes.push({
        id: `${layerIndex}:${i}`,
        layer: layerIndex,
        index: i,
        x: layer.x + rand(-0.018, 0.018),
        y: y + rand(-0.018, 0.018),
        radius: rand(3.5, 8.5),
        charge: rand(0.08, 0.78),
        phase: rand(0, TAU),
        hue: layer.hue,
        name: layer.name,
      });
    }
  });

  for (let layer = 0; layer < LAYERS.length - 1; layer += 1) {
    const from = nodes.filter((node) => node.layer === layer);
    const to = nodes.filter((node) => node.layer === layer + 1);
    from.forEach((source) => {
      const targets = [...to].sort((a, b) => Math.abs(a.y - source.y) - Math.abs(b.y - source.y)).slice(0, 4);
      targets.forEach((target, targetIndex) => {
        links.push({
          source,
          target,
          weight: rand(0.16, 0.92) * (1 - targetIndex * 0.12),
          phase: rand(0, TAU),
        });
      });
    });
  }

  return { nodes, links };
}

function drawText(ctx, text, x, y, size, alpha = 1, align = 'left') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255,248,239,0.92)';
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawNetwork(ctx, network, signals, pointer, frame, width, height, intensity) {
  const t = frame * 0.016;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#03030a');
  bg.addColorStop(0.42, '#090a1d');
  bg.addColorStop(1, '#05020b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.58);
  halo.addColorStop(0, `rgba(145,216,255,${0.09 + intensity * 0.08})`);
  halo.addColorStop(0.48, 'rgba(196,181,253,0.08)');
  halo.addColorStop(1, 'rgba(255,226,191,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  network.links.forEach((link) => {
    const sx = link.source.x * width;
    const sy = link.source.y * height;
    const tx = link.target.x * width;
    const ty = link.target.y * height;
    const activity = clamp((link.source.charge + link.target.charge) * 0.5 + Math.sin(t * 2 + link.phase) * 0.2, 0, 1);
    const alpha = 0.035 + activity * link.weight * 0.32;
    ctx.strokeStyle = `rgba(255,248,239,${alpha})`;
    ctx.lineWidth = 0.55 + activity * 1.8;
    ctx.beginPath();
    const mx = (sx + tx) * 0.5;
    const bend = Math.sin(t + link.phase) * 18;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, (sy + ty) * 0.5 + bend, tx, ty);
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  signals.forEach((signal) => {
    const link = network.links[signal.linkIndex % network.links.length];
    if (!link) return;
    const p = signal.progress;
    const sx = link.source.x * width;
    const sy = link.source.y * height;
    const tx = link.target.x * width;
    const ty = link.target.y * height;
    const cx = (sx + tx) * 0.5;
    const cy = (sy + ty) * 0.5 + Math.sin(t + link.phase) * 18;
    const x = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * cx + p * p * tx;
    const y = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * cy + p * p * ty;
    const radius = 2.5 + signal.force * 9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
    glow.addColorStop(0, `rgba(${signal.hue},0.95)`);
    glow.addColorStop(1, `rgba(${signal.hue},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.62 + signal.force * 0.28})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  });
  ctx.restore();

  network.nodes.forEach((node) => {
    const x = node.x * width;
    const y = node.y * height;
    const pulse = clamp(node.charge + Math.sin(t * 3 + node.phase) * 0.18, 0, 1);
    const r = node.radius + pulse * 11;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = `rgba(${node.hue},1)`;
    ctx.shadowBlur = 12 + pulse * 34;
    ctx.fillStyle = `rgba(${node.hue},${0.08 + pulse * 0.32})`;
    ctx.strokeStyle = `rgba(${node.hue},${0.36 + pulse * 0.48})`;
    ctx.lineWidth = 0.7 + pulse * 1.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.34 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.7 + pulse * 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  });

  if (pointer) {
    const age = Math.min(1, (performance.now() - pointer.time) / 1200);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255,226,191,${1 - age})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(pointer.x * width, pointer.y * height, 24 + age * 120, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  LAYERS.forEach((layer) => {
    drawText(ctx, layer.name, layer.x * width, height * 0.075, Math.max(9, Math.min(12, width / 92)), 0.55, 'center');
  });

  drawText(ctx, 'NEURAL FIELD / MIRROR CARTOGRAPHER', width * 0.055, height * 0.055, Math.max(14, Math.min(24, width / 44)), 0.95);
  drawText(ctx, 'not a literal brain scan — a working interface map of input → symbol → context → inference → output', width * 0.055, height * 0.095, Math.max(9, Math.min(13, width / 88)), 0.55);

  const caption = CAPTIONS[Math.floor(frame / 150) % CAPTIONS.length];
  drawText(ctx, caption, width * 0.5, height * 0.925, Math.max(11, Math.min(16, width / 70)), 0.78, 'center');
}

function useNeuralCanvas(network, signals, pointer, intensity) {
  const ref = useRef(null);
  const stateRef = useRef({ signals, pointer, intensity });

  useEffect(() => {
    stateRef.current = { signals, pointer, intensity };
  }, [signals, pointer, intensity]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const loop = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const current = stateRef.current;
      drawNetwork(ctx, network, current.signals, current.pointer, frame, rect.width, rect.height, current.intensity);
      raf = requestAnimationFrame(loop);
    };

    resize();
    loop();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [network]);

  return ref;
}

export default function App() {
  const [network] = useState(() => makeNetwork());
  const [signals, setSignals] = useState(() => network.links.slice(0, 34).map((_, index) => ({
    linkIndex: index,
    progress: Math.random(),
    speed: rand(0.006, 0.022),
    force: rand(0.22, 0.9),
    hue: LAYERS[index % LAYERS.length].hue,
  })));
  const [pointer, setPointer] = useState(null);
  const [intensity, setIntensity] = useState(0.45);
  const canvasRef = useNeuralCanvas(network, signals, pointer, intensity);

  useEffect(() => {
    const id = window.setInterval(() => {
      network.nodes.forEach((node) => {
        node.charge = clamp(node.charge * 0.965 + rand(0, 0.035), 0.03, 1);
      });
      setSignals((items) => items.map((signal) => {
        let progress = signal.progress + signal.speed * (0.55 + intensity);
        let linkIndex = signal.linkIndex;
        let force = signal.force * 0.985;
        if (progress >= 1) {
          progress = 0;
          linkIndex = Math.floor(Math.random() * network.links.length);
          const link = network.links[linkIndex];
          link.target.charge = clamp(link.target.charge + 0.26 + force * 0.18, 0, 1);
          force = rand(0.2, 1);
        }
        return { ...signal, progress, linkIndex, force };
      }));
      setIntensity((value) => clamp(value * 0.985 + 0.01, 0.28, 1));
    }, 32);
    return () => window.clearInterval(id);
  }, [network, intensity]);

  const inject = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const nearest = [...network.nodes]
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
      .slice(0, 8);
    nearest.forEach((node, index) => {
      node.charge = clamp(node.charge + 0.8 - index * 0.075, 0, 1);
    });
    setPointer({ x, y, time: performance.now() });
    setIntensity(1);
    setSignals((items) => [
      ...items.slice(-42),
      ...nearest.map((node, index) => {
        const matching = network.links.findIndex((link) => link.source.id === node.id || link.target.id === node.id);
        return {
          linkIndex: matching >= 0 ? matching : Math.floor(Math.random() * network.links.length),
          progress: 0,
          speed: rand(0.018, 0.04),
          force: 1 - index * 0.06,
          hue: node.hue,
        };
      }),
    ]);
  };

  return (
    <main className="neural-page" aria-label="interactive neural network visualization">
      <style>{css}</style>
      <button className="neural-canvas" onPointerDown={inject} onPointerMove={(event) => event.buttons === 1 && inject(event)} aria-label="inject signal into the neural field">
        <canvas ref={canvasRef} />
      </button>
      <section className="panel" aria-label="system legend">
        <p className="kicker">LIVE MODEL VIEW</p>
        <h1>Watch the network think.</h1>
        <p>Input becomes symbolic pressure, gates choose context, inference fires, and the output state feeds back into the field.</p>
        <div className="metrics" aria-hidden="true">
          <span><b>{network.nodes.length}</b> nodes</span>
          <span><b>{network.links.length}</b> links</span>
          <span><b>{signals.length}</b> pulses</span>
        </div>
      </section>
    </main>
  );
}

const css = `
*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0;background:#03030a}body{overflow:hidden;overscroll-behavior:none}.neural-page{min-height:100vh;background:#03030a;color:#fff8ef;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.neural-canvas{position:fixed;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:#03030a;cursor:crosshair;touch-action:none;-webkit-tap-highlight-color:transparent}.neural-canvas canvas{display:block;width:100%;height:100%}.panel{position:fixed;left:clamp(16px,4vw,54px);bottom:clamp(18px,5vw,58px);width:min(420px,calc(100vw - 32px));padding:18px 20px 20px;border:1px solid rgba(255,248,239,.14);border-radius:28px;background:linear-gradient(145deg,rgba(8,8,24,.58),rgba(8,4,16,.36));backdrop-filter:blur(22px);box-shadow:0 24px 90px rgba(0,0,0,.42);pointer-events:none}.kicker{margin:0 0 8px;font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.22em;color:rgba(255,226,191,.72)}h1{margin:0 0 8px;font-size:clamp(28px,5vw,54px);line-height:.92;letter-spacing:-.055em;font-weight:760}p{margin:0;color:rgba(255,248,239,.68);font-size:clamp(13px,2vw,16px);line-height:1.45}.metrics{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.metrics span{display:inline-flex;gap:6px;align-items:baseline;border:1px solid rgba(255,255,255,.11);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.045);font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(255,248,239,.7)}.metrics b{font-size:13px;color:#fff8ef}@media (max-width:720px){.panel{padding:14px 15px 16px;border-radius:22px}.metrics{display:none}}@media (prefers-reduced-motion:reduce){.panel{backdrop-filter:none}}
`;
