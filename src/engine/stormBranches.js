const TAU = Math.PI * 2;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function ageOf(mark, lifetime = 5200) {
  return Math.min(1, (Date.now() - mark.time) / lifetime);
}

function colorFor(kind, alpha) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  return `rgba(239,251,255,${alpha})`;
}

function branchBias(kind) {
  if (kind === 'rain') return { reach: 0.72, curl: -0.45, fork: 0.32 };
  if (kind === 'wind') return { reach: 0.55, curl: 0.9, fork: 0.22 };
  if (kind === 'murmur') return { reach: 0.62, curl: 0.65, fork: 0.38 };
  if (kind === 'aurora') return { reach: 0.5, curl: 0.7, fork: 0.28 };
  if (kind === 'dawn') return { reach: 0.44, curl: 0.38, fork: 0.18 };
  return { reach: 0.64, curl: 0.12, fork: 0.26 };
}

export function createStormBranches(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    seed: Math.sin((i + 1) * 999.913) * 43758.5453,
    bend: Math.sin(i * 2.17) * 0.65,
  }));
}

export function drawStormBranches(ctx, branches, marks, env) {
  const { width, height, time, pulse, rhythm, state, budget } = env;
  const active = marks.slice(-(budget.stormBranchMarks || 6));
  if (!active.length) return;

  const branchCount = Math.min(branches.length, budget.stormBranches || 10);
  const segments = budget.stormBranchSegments || 8;
  const visible = state === 'lightning' || state === 'rain' || pulse > 0.72 || rhythm > 4;
  if (!visible) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = state === 'murmur' ? '#c4b5fd' : state === 'rain' ? '#91d8ff' : '#effbff';
  ctx.shadowBlur = budget.mobile ? 14 : 24;

  for (let b = 0; b < branchCount; b += 1) {
    const mark = active[(active.length - 1 - b + active.length) % active.length];
    const age = ageOf(mark);
    const life = Math.max(0, 1 - age);
    if (life <= 0.03) continue;

    const branch = branches[b];
    const bias = branchBias(mark.kind || state);
    const beat = Math.max(0, Math.sin(time * 0.075 + branch.seed + rhythm * 0.35));
    const perform = state === 'lightning' ? beat ** 8 : beat ** 3;
    const alpha = clamp((0.035 + pulse * 0.06 + perform * 0.38) * life, 0, 0.8);
    const startX = mark.x * width;
    const startY = mark.y * height;
    const upward = mark.y > 0.55 ? -1 : 1;
    const baseAngle = -Math.PI / 2 * upward + branch.bend * 0.55 + Math.sin(time * 0.011 + b) * bias.curl;
    const length = (height * (0.08 + bias.reach * 0.18) + pulse * 70) * life * (budget.mobile ? 0.72 : 1);

    ctx.strokeStyle = colorFor(mark.kind || state, alpha);
    ctx.lineWidth = 0.7 + life * 1.4 + perform * 2.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    let x = startX;
    let y = startY;
    for (let s = 1; s <= segments; s += 1) {
      const q = s / segments;
      const jitter = Math.sin(branch.seed + s * 12.989 + time * 0.031) * (10 + rhythm * 1.2) * life;
      const curl = Math.sin(q * TAU + branch.seed + time * 0.019) * bias.curl * 22 * life;
      x += Math.cos(baseAngle + curl * 0.018) * (length / segments) + jitter;
      y += Math.sin(baseAngle + curl * 0.018) * (length / segments) + Math.cos(branch.seed + s) * 7 * life;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (perform > 0.22 && b % 2 === 0) {
      ctx.lineWidth *= 0.55;
      ctx.globalAlpha = 0.72;
      for (let f = 0; f < 2; f += 1) {
        const forkAngle = baseAngle + (f ? 1 : -1) * (0.72 + bias.fork);
        const fx = startX + Math.cos(baseAngle) * length * 0.46;
        const fy = startY + Math.sin(baseAngle) * length * 0.46;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(forkAngle) * length * 0.32, fy + Math.sin(forkAngle) * length * 0.32);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}
