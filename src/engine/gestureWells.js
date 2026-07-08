const TAU = Math.PI * 2;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function ageOf(mark, lifetime = 7200) {
  return Math.min(1, (Date.now() - mark.time) / lifetime);
}

function colorFor(kind, alpha) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

function wellMood(kind) {
  if (kind === 'rain') return { pull: 0.62, spin: -1.2, wobble: 0.7, ring: 0.9 };
  if (kind === 'wind') return { pull: 0.42, spin: 1.8, wobble: 1.25, ring: 1.18 };
  if (kind === 'murmur') return { pull: 0.72, spin: 1.45, wobble: 1.05, ring: 1.35 };
  if (kind === 'aurora') return { pull: 0.48, spin: 1.15, wobble: 1.4, ring: 1.28 };
  if (kind === 'dawn') return { pull: 0.36, spin: 0.72, wobble: 0.8, ring: 0.78 };
  if (kind === 'lightning') return { pull: 0.84, spin: -2.1, wobble: 1.7, ring: 0.66 };
  return { pull: 0.4, spin: 0.9, wobble: 0.72, ring: 1 };
}

export function createGestureWells(count = 34) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    orbit: 0.18 + ((i * 37) % 100) / 100,
    phase: Math.sin((i + 1) * 12.9898) * 43758.5453,
    weight: 0.55 + ((i * 19) % 100) / 130,
    offset: ((i * 47) % 100) / 100,
  }));
}

export function drawGestureWells(ctx, wells, marks, env) {
  const { width, height, time, pulse, rhythm, state, budget } = env;
  const active = marks.slice(-(budget.gestureWellMarks || 7));
  const particleCount = Math.min(wells.length, budget.gestureWellParticles || 24);
  if (!active.length || particleCount < 3) return;

  const scale = Math.min(width, height);
  const visiblePulse = pulse > 0.34 || rhythm > 1 || state === 'murmur' || state === 'lightning';
  if (!visiblePulse) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = budget.mobile ? 9 : 18;

  active.forEach((mark, markIndex) => {
    const age = ageOf(mark);
    const life = Math.max(0, 1 - age);
    if (life <= 0.025) return;

    const mood = wellMood(mark.kind || state);
    const cx = mark.x * width;
    const cy = mark.y * height;
    const baseRadius = scale * (0.035 + mood.ring * 0.055 + pulse * 0.025) * (1 + markIndex * 0.045);
    const spring = Math.sin(time * 0.052 + mark.spin + markIndex) * (5 + rhythm * mood.wobble) * life;
    const alpha = clamp((0.035 + pulse * 0.05 + rhythm * 0.009) * life, 0.02, 0.26);
    const color = colorFor(mark.kind || state, alpha);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = colorFor(mark.kind || state, 0.9);

    ctx.globalAlpha = 0.38 * life;
    ctx.lineWidth = 0.65 + pulse * 0.7;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.08; a += 0.18) {
      const r = baseRadius + Math.sin(a * 5 + time * 0.025 + mark.spin) * (4 + rhythm * 0.35) * life;
      const x = cx + Math.cos(a) * r * (1.18 + mood.pull * 0.2);
      const y = cy + Math.sin(a) * r * (0.72 + mood.pull * 0.1);
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    for (let i = 0; i < particleCount; i += 1) {
      const seed = wells[i];
      const q = (i + 0.5) / particleCount;
      const orbit = baseRadius * (0.42 + seed.orbit * 1.85);
      const acceleration = mood.spin * (0.008 + q * 0.012 + rhythm * 0.0008);
      const angle = seed.phase + time * acceleration + mark.spin * 0.35 + markIndex * 0.7;
      const tug = Math.sin(time * 0.044 + seed.phase + pulse * 2.4) * spring;
      const recoil = state === 'lightning' ? Math.max(0, Math.sin(time * 0.13 + seed.phase)) * 18 * life : 0;
      const x = cx + Math.cos(angle) * (orbit + tug + recoil) * (1 + mood.pull * 0.18);
      const y = cy + Math.sin(angle) * (orbit * 0.62 + tug * 0.42 - recoil * 0.25);
      const size = (0.8 + seed.weight * 1.4 + pulse * 1.3) * life;

      ctx.globalAlpha = clamp(alpha * (0.78 + Math.sin(angle + time * 0.03) * 0.32), 0, 0.32);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.4, size), 0, TAU);
      ctx.fill();

      if (!budget.mobile && i % 3 === 0) {
        ctx.globalAlpha *= 0.34;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle - 0.18) * orbit * 0.7, cy + Math.sin(angle - 0.18) * orbit * 0.42);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  });

  ctx.restore();
}
