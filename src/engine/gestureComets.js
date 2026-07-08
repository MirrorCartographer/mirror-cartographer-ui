const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const wave = (time, speed, phase = 0) => Math.sin(time * speed + phase);

function colorFor(kind, alpha = 1) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

function makeComet(i) {
  const x = 0.5 + wave(i, 1.7) * 0.22;
  const y = 0.48 + wave(i, 1.1) * 0.18;
  return {
    i,
    x,
    y,
    oldX: x,
    oldY: y,
    phase: Math.sin((i + 3) * 9.137) * 8000,
    courage: 0.55 + ((i * 23) % 60) / 100,
    wake: Array.from({ length: 9 }, () => ({ x, y })),
  };
}

export function createGestureComets(count = 14) {
  return Array.from({ length: count }, (_, i) => makeComet(i));
}

function currentTarget(active, state, time, index) {
  const mark = active[active.length - 1 - (index % Math.max(1, active.length))];
  if (mark && Number.isFinite(mark.x) && Number.isFinite(mark.y)) {
    return { x: clamp01(mark.x), y: clamp01(mark.y), kind: mark.kind || state, alive: true };
  }
  return {
    x: 0.5 + wave(time, 0.004, index) * 0.23,
    y: 0.52 + wave(time, 0.003, index * 1.9) * 0.15,
    kind: state,
    alive: false,
  };
}

export function drawGestureComets(ctx, comets, env) {
  const { width: w, height: h, time: t, active = [], budget, state, pulse, rhythm } = env;
  if (!Array.isArray(comets) || !comets.length) return;

  const count = Math.min(comets.length, budget.mobile ? 7 : 14);
  const intensity = clamp(0.28 + pulse * 0.62 + rhythm * 0.035, 0, 1.15);
  const neighborReach = budget.mobile ? 0.16 : 0.2;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < count; i += 1) {
    const comet = comets[i];
    const target = currentTarget(active, state, t, i);
    const curiosity = target.alive ? 0.026 + pulse * 0.018 : 0.006;
    const orbit = 0.045 + (i / Math.max(1, count - 1)) * 0.12;
    const lureX = clamp01(target.x + Math.cos(t * 0.011 + comet.phase) * orbit);
    const lureY = clamp01(target.y + Math.sin(t * 0.009 + comet.phase) * orbit * 0.62);

    let separateX = 0;
    let separateY = 0;
    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const other = comets[j];
      const dx = comet.x - other.x;
      const dy = comet.y - other.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.00001 && d2 < neighborReach * neighborReach) {
        const push = (1 - Math.sqrt(d2) / neighborReach) * 0.0028;
        separateX += (dx / Math.sqrt(d2)) * push;
        separateY += (dy / Math.sqrt(d2)) * push;
      }
    }

    const vx = (comet.x - comet.oldX) * (state === 'rain' ? 0.91 : 0.955);
    const vy = (comet.y - comet.oldY) * (state === 'rain' ? 0.9 : 0.95);
    comet.oldX = comet.x;
    comet.oldY = comet.y;
    comet.x = clamp(comet.x + vx + (lureX - comet.x) * curiosity + separateX + wave(t, 0.017, comet.phase) * 0.0009 * comet.courage, -0.08, 1.08);
    comet.y = clamp(comet.y + vy + (lureY - comet.y) * curiosity + separateY + (state === 'rain' ? 0.0009 : -0.00012) + wave(t, 0.014, comet.phase) * 0.0007, -0.08, 1.08);

    comet.wake.unshift({ x: comet.x, y: comet.y });
    comet.wake.length = budget.mobile ? 6 : 9;

    const kind = target.kind || state;
    const spark = Math.max(0, wave(t, state === 'lightning' ? 0.12 : 0.054, comet.phase));
    ctx.strokeStyle = colorFor(kind, 0.1 + intensity * 0.16 + spark * 0.12);
    ctx.fillStyle = colorFor(kind, 0.18 + spark * 0.24);
    ctx.shadowColor = colorFor(kind, 0.92);
    ctx.shadowBlur = budget.mobile ? 7 + spark * 6 : 14 + spark * 16;
    ctx.lineWidth = budget.mobile ? 0.65 + pulse * 0.52 : 0.86 + pulse * 0.75;
    ctx.globalAlpha = (0.28 + intensity * 0.36) * (target.alive ? 1 : 0.62);

    ctx.beginPath();
    comet.wake.forEach((point, wakeIndex) => {
      const x = point.x * w;
      const y = point.y * h;
      if (wakeIndex === 0) ctx.moveTo(x, y);
      else {
        const prev = comet.wake[wakeIndex - 1];
        const sag = Math.sin(t * 0.018 + wakeIndex + comet.phase) * (2 + rhythm * 0.35);
        ctx.quadraticCurveTo((prev.x + point.x) * 0.5 * w, (prev.y + point.y) * 0.5 * h + sag, x, y);
      }
    });
    ctx.stroke();

    const heading = Math.atan2(comet.y - comet.oldY, comet.x - comet.oldX);
    const size = Math.min(w, h) * (budget.mobile ? 0.006 : 0.0075) * (1 + spark * 0.8 + pulse * 0.4);
    ctx.save();
    ctx.translate(comet.x * w, comet.y * h);
    ctx.rotate(heading + wave(t, 0.03, comet.phase) * 0.16);
    ctx.globalAlpha = 0.48 + spark * 0.3;
    ctx.beginPath();
    ctx.moveTo(size * 2.4, 0);
    ctx.quadraticCurveTo(-size * 0.4, -size * (1.2 + spark), -size * 1.6, 0);
    ctx.quadraticCurveTo(-size * 0.4, size * (1.2 + spark), size * 2.4, 0);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
