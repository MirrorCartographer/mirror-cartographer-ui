const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));

function colorFor(kind, alpha = 1) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

export function createSkyRopes(count = 5, nodeCount = 9) {
  return Array.from({ length: count }, (_, r) => ({
    rest: 0.052 + r * 0.006,
    nodes: Array.from({ length: nodeCount }, (_, i) => {
      const x = 0.18 + r * 0.12 + i * 0.038;
      const y = 0.3 + Math.sin(i * 0.9 + r) * 0.035 + r * 0.045;
      return { x, y, oldX: x, oldY: y };
    })
  }));
}

function anchorFor(active, state, time, r) {
  const mark = active[active.length - 1 - (r % Math.max(1, active.length))];
  if (mark) return { x: mark.x, y: mark.y, kind: mark.kind || state, touched: true };
  return { x: 0.5 + Math.sin(time * 0.006 + r * 1.7) * 0.22, y: 0.46 + Math.cos(time * 0.004 + r) * 0.18, kind: state, touched: false };
}

export function drawSkyRopes(ctx, ropes, env) {
  const { width: w, height: h, time, active, budget, state, pulse, rhythm } = env;
  if (!ropes?.length || w <= 0 || h <= 0) return;
  const mobile = Boolean(budget?.mobile);
  const ropeCount = Math.min(ropes.length, mobile ? 3 : ropes.length);
  const fall = (state === 'rain' ? 0.00042 : state === 'wind' ? -0.00008 : 0.00016) * (1 + pulse * 0.8);
  const drift = (state === 'wind' || state === 'murmur' ? 0.00072 : 0.00022) * Math.sin(time * 0.018 + rhythm * 0.2);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let r = 0; r < ropeCount; r += 1) {
    const rope = ropes[r];
    const nodes = rope.nodes;
    if (!nodes?.length) continue;
    const anchor = anchorFor(active, state, time, r);

    nodes[0].x += (anchor.x - nodes[0].x) * (anchor.touched ? 0.42 : 0.055);
    nodes[0].y += (anchor.y - nodes[0].y) * (anchor.touched ? 0.42 : 0.055);
    nodes[0].oldX = nodes[0].x;
    nodes[0].oldY = nodes[0].y;

    for (let i = 1; i < nodes.length; i += 1) {
      const n = nodes[i];
      const vx = (n.x - n.oldX) * 0.985;
      const vy = (n.y - n.oldY) * 0.985;
      n.oldX = n.x;
      n.oldY = n.y;
      n.x = clamp(n.x + vx + drift * (i / nodes.length) + Math.sin(time * 0.013 + i + r) * 0.00016, -0.08, 1.08);
      n.y = clamp(n.y + vy + fall + Math.cos(time * 0.011 + i * 1.7) * 0.00012, -0.08, 1.08);
    }

    for (let pass = 0; pass < (mobile ? 2 : 3); pass += 1) {
      for (let i = 1; i < nodes.length; i += 1) {
        const a = nodes[i - 1];
        const b = nodes[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(0.0001, Math.hypot(dx, dy));
        const diff = (d - rope.rest) / d;
        const k = 0.52 + pulse * 0.12;
        if (i > 1) {
          a.x += dx * diff * k * 0.5;
          a.y += dy * diff * k * 0.5;
        }
        b.x -= dx * diff * k * 0.5;
        b.y -= dy * diff * k * 0.5;
      }
    }

    const color = colorFor(anchor.kind, 0.14 + pulse * 0.22 + rhythm * 0.012);
    ctx.strokeStyle = color;
    ctx.shadowColor = colorFor(anchor.kind, 0.78);
    ctx.shadowBlur = mobile ? 7 : 18;
    ctx.lineWidth = Math.max(0.65, Math.min(w, h) * (mobile ? 0.0016 : 0.0022) * (1 + pulse * 0.45));
    ctx.globalAlpha = (anchor.touched ? 1 : 0.58) * (0.48 + pulse * 0.32);
    ctx.beginPath();
    nodes.forEach((n, i) => {
      const x = n.x * w;
      const y = n.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const p = nodes[i - 1];
        const cx = (p.x + n.x) * 0.5 * w + Math.sin(time * 0.018 + i + r) * (2 + rhythm * 0.25);
        const cy = (p.y + n.y) * 0.5 * h + Math.cos(time * 0.016 + i) * (2 + pulse * 4);
        ctx.quadraticCurveTo(cx, cy, x, y);
      }
    });
    ctx.stroke();

    if (!mobile) {
      ctx.fillStyle = colorFor(anchor.kind, 0.35 + pulse * 0.2);
      nodes.forEach((n, i) => {
        if (i % 2 === 0) return;
        const beat = Math.max(0, Math.sin(time * 0.05 + i * 1.2 + r));
        ctx.globalAlpha = (anchor.touched ? 1 : 0.58) * (0.06 + beat * 0.18);
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, 1.2 + beat * 2.4 + pulse * 1.8, 0, TAU);
        ctx.fill();
      });
    }
  }

  ctx.restore();
}
