const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const lerp = (a, b, t) => a + (b - a) * t;

function colorFor(kind, alpha = 1) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

export function createCreatureWeather() {
  return {
    swarm: Array.from({ length: 28 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: 0.4 + Math.random() * 1.4, r: 0.8 + Math.random() * 2.2 })),
    flock: Array.from({ length: 18 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: 0.5 + Math.random(), k: 0.7 + Math.random() * 1.3 })),
    clouds: Array.from({ length: 4 }, (_, i) => ({ i, x: Math.random(), y: 0.1 + Math.random() * 0.3, p: Math.random() * TAU, k: 0.8 + Math.random() }))
  };
}

function mood(state, pulse, rhythm) {
  return {
    speed: (state === 'wind' || state === 'lightning' || state === 'murmur' ? 1.35 : 0.85) + pulse * 0.45 + rhythm * 0.035,
    gather: state === 'clear' ? 1.25 : state === 'wind' ? 0.68 : state === 'murmur' ? 1.15 : 0.9,
    alarm: state === 'lightning' ? 1.45 : state === 'rain' ? 0.9 : 0.55,
    beat: state === 'lightning' ? 1.9 : state === 'wind' ? 1.45 : state === 'rain' ? 0.82 : 1
  };
}

export function drawCreatureWeather(ctx, ecology, env) {
  const { width: w, height: h, time: t, active, budget, state, pulse, rhythm } = env;
  const m = mood(state, pulse, rhythm);
  const target = active.at(-1) || { x: 0.5 + Math.sin(t * 0.006) * 0.22, y: 0.54 + Math.cos(t * 0.004) * 0.16, kind: state };
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ecology.clouds.slice(0, budget.mobile ? 2 : 4).forEach((c) => {
    const x = ((c.x + t * 0.00032 * m.speed + Math.sin(t * 0.004 + c.p) * 0.035 + 1) % 1) * w;
    const y = clamp01(c.y + Math.cos(t * 0.006 + c.p) * 0.035) * h;
    const size = Math.min(w, h) * 0.06 * c.k * (1 + pulse * 0.16);
    ctx.globalAlpha = 0.12 + pulse * 0.11;
    ctx.fillStyle = colorFor(state, 0.2);
    ctx.shadowColor = colorFor(state, 0.8);
    ctx.shadowBlur = budget.mobile ? 10 : 18;
    ctx.beginPath();
    for (let lobe = 0; lobe < 7; lobe += 1) {
      const a = (lobe / 7) * TAU + t * 0.002 * m.beat;
      const lx = x + Math.cos(a) * size * (0.35 + (lobe % 3) * 0.14);
      const ly = y + Math.sin(a * 1.7) * size * 0.22;
      ctx.moveTo(lx + size * 0.3, ly);
      ctx.arc(lx, ly, size * (0.3 + (lobe % 4) * 0.05), 0, TAU);
    }
    ctx.fill();
  });
  const flockCount = Math.min(ecology.flock.length, budget.mobile ? 10 : 18);
  ecology.flock.slice(0, flockCount).forEach((b, i) => {
    const q = i / Math.max(1, flockCount - 1);
    const phase = b.p + t * 0.0065 * b.s * m.speed;
    const orbit = 0.08 + q * 0.16 * m.gather;
    const xNorm = clamp01(target.x + Math.cos(phase) * orbit + Math.sin(t * 0.017 + b.i) * 0.03 * m.alarm);
    const yNorm = clamp01(target.y + Math.sin(phase * 0.86) * orbit * 0.58 + Math.cos(phase * 1.3) * 0.04);
    const body = Math.min(w, h) * 0.006 * b.k;
    const face = Math.atan2(target.y - yNorm, target.x - xNorm);
    const wing = Math.sin(t * 0.14 * m.beat + b.i) * (5 + rhythm * 0.45) * b.k;
    ctx.save();
    ctx.translate(xNorm * w, yNorm * h);
    ctx.rotate(face + Math.PI);
    ctx.strokeStyle = colorFor(target.kind || state, 0.2 + pulse * 0.22);
    ctx.fillStyle = colorFor(target.kind || state, 0.18 + pulse * 0.16);
    ctx.shadowColor = colorFor(target.kind || state, 0.9);
    ctx.shadowBlur = budget.mobile ? 5 : 12;
    ctx.globalAlpha = 0.45 + pulse * 0.28;
    ctx.lineWidth = Math.max(0.8, body * 0.42);
    ctx.beginPath();
    ctx.moveTo(-body * 2.2, wing);
    ctx.quadraticCurveTo(0, -body * 0.8, body * 2.2, -wing);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, body), 0, TAU);
    ctx.fill();
    ctx.restore();
  });
  ecology.swarm.slice(0, budget.mobile ? 16 : 28).forEach((f, i) => {
    const q = i / 28;
    const beat = Math.max(0, Math.sin(t * 0.052 * m.beat + f.p + q * 4));
    const radius = (0.08 + q * 0.2) * (1 + pulse * 0.25);
    const x = clamp01(lerp(f.x, target.x, 0.42) + Math.cos(t * 0.011 * f.s + f.p) * radius) * w;
    const y = clamp01(lerp(f.y, target.y, 0.38) + Math.sin(t * 0.014 * f.s + f.p * 1.4) * radius * 0.62) * h;
    ctx.globalAlpha = 0.08 + beat * (0.22 + pulse * 0.18);
    ctx.fillStyle = colorFor(target.kind || state, 0.72);
    ctx.shadowColor = colorFor(target.kind || state, 1);
    ctx.shadowBlur = 8 + beat * 18;
    ctx.beginPath();
    ctx.arc(x, y, f.r + beat * (1.4 + pulse * 2), 0, TAU);
    ctx.fill();
  });
  if (state === 'rain' || state === 'murmur' || pulse > 0.5) {
    ctx.strokeStyle = colorFor(state === 'rain' ? 'rain' : 'murmur', 0.18 + pulse * 0.12);
    ctx.lineWidth = 0.7 + pulse * 0.6;
    active.slice(-(budget.mobile ? 5 : 8)).forEach((mark, i) => {
      const age = Math.min(1, (Date.now() - mark.time) / 5200);
      const life = 1 - age;
      const base = Math.min(w, h) * (0.025 + age * 0.22);
      ctx.globalAlpha = life * 0.34;
      ctx.beginPath();
      ctx.ellipse(mark.x * w, h * (0.72 + Math.sin(t * 0.006 + i) * 0.03), base * 1.6, base * 0.22, 0, 0, TAU);
      ctx.stroke();
    });
  }
  ctx.restore();
}
