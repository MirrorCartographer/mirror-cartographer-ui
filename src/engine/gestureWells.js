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
  if (kind === 'rain') return { pull: 0.62, spin: -1.2, wobble: 0.7, ring: 0.9, braid: 0.72 };
  if (kind === 'wind') return { pull: 0.42, spin: 1.8, wobble: 1.25, ring: 1.18, braid: 1.35 };
  if (kind === 'murmur') return { pull: 0.72, spin: 1.45, wobble: 1.05, ring: 1.35, braid: 1.2 };
  if (kind === 'aurora') return { pull: 0.48, spin: 1.15, wobble: 1.4, ring: 1.28, braid: 1.45 };
  if (kind === 'dawn') return { pull: 0.36, spin: 0.72, wobble: 0.8, ring: 0.78, braid: 0.9 };
  if (kind === 'lightning') return { pull: 0.84, spin: -2.1, wobble: 1.7, ring: 0.66, braid: 1.7 };
  return { pull: 0.4, spin: 0.9, wobble: 0.72, ring: 1, braid: 1 };
}

export function createGestureWells(count = 34) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    orbit: 0.18 + ((i * 37) % 100) / 100,
    phase: Math.sin((i + 1) * 12.9898) * 43758.5453,
    weight: 0.55 + ((i * 19) % 100) / 130,
    offset: ((i * 47) % 100) / 100,
    slack: 0.34 + ((i * 29) % 100) / 160,
  }));
}

function springPoint(cx, cy, radius, angle, mood, time, mark, rhythm, life, q) {
  const breath = Math.sin(time * 0.046 + mark.spin + q * TAU) * (4 + rhythm * 0.55) * life;
  const braid = Math.sin(time * 0.031 + q * 9 + mark.spin) * radius * 0.1 * mood.braid * life;
  const recoil = mark.kind === 'lightning' ? Math.max(0, Math.sin(time * 0.14 + q * 7)) * radius * 0.16 * life : 0;
  const x = cx + Math.cos(angle) * (radius + breath + recoil) * (1.08 + mood.pull * 0.16) + Math.cos(angle + Math.PI / 2) * braid;
  const y = cy + Math.sin(angle) * (radius * (0.62 + mood.pull * 0.1) + breath * 0.44 - recoil * 0.18) + Math.sin(angle + Math.PI / 2) * braid * 0.54;
  return { x, y };
}

function drawSpringThreads(ctx, wells, mark, env, baseRadius, mood, life, color) {
  const { width, height, time, pulse, rhythm, budget } = env;
  const threadCount = budget.gestureWellThreads || 0;
  const nodeCount = budget.gestureWellThreadNodes || 0;
  if (threadCount < 1 || nodeCount < 4) return;

  const cx = mark.x * width;
  const cy = mark.y * height;
  const nodeStep = 1 / Math.max(1, nodeCount - 1);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = colorFor(mark.kind, 0.8);
  ctx.shadowBlur = budget.mobile ? 7 : 16;

  for (let thread = 0; thread < threadCount; thread += 1) {
    const seed = wells[(thread * 5) % wells.length];
    const threadPhase = seed.phase + mark.spin * 0.5 + thread * 1.88;
    const radius = baseRadius * (0.72 + seed.slack + thread * 0.18);
    const spin = mood.spin * (0.006 + thread * 0.0025 + rhythm * 0.00045);
    const tension = clamp(0.1 + pulse * 0.18 + rhythm * 0.014, 0.12, 0.42) * life;

    ctx.globalAlpha = tension;
    ctx.lineWidth = clamp(0.42 + pulse * 0.5 - thread * 0.04, 0.34, 1.2);
    ctx.beginPath();

    for (let node = 0; node < nodeCount; node += 1) {
      const q = node * nodeStep;
      const wave = Math.sin(q * Math.PI) * Math.sin(time * 0.04 + threadPhase + q * 7) * 0.42;
      const angle = threadPhase + time * spin + q * TAU * (0.68 + mood.braid * 0.14) + wave;
      const p = springPoint(cx, cy, radius * (0.58 + q * 0.92), angle, mood, time, mark, rhythm, life, q + thread * 0.17);
      if (node === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();

    if (!budget.mobile) {
      ctx.globalAlpha = tension * 0.42;
      for (let node = 1; node < nodeCount - 1; node += 3) {
        const q = node * nodeStep;
        const angle = threadPhase + time * spin + q * TAU;
        const p = springPoint(cx, cy, radius * (0.72 + q * 0.7), angle, mood, time, mark, rhythm, life, q);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.7 + pulse * 0.9, 0, TAU);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
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

    drawSpringThreads(ctx, wells, { ...mark, kind: mark.kind || state }, env, baseRadius, mood, life, colorFor(mark.kind || state, alpha * 0.92));

    ctx.globalAlpha = 1;
    for (let i = 0; i < particleCount; i += 1) {
      const seed = wells[i];
      const q = (i + 0.5) / particleCount;
      const orbit = baseRadius * (0.42 + seed.orbit * 1.85);
      const acceleration = mood.spin * (0.008 + q * 0.012 + rhythm * 0.0008);
      const angle = seed.phase + time * acceleration + mark.spin * 0.35 + markIndex * 0.7;
      const tug = Math.sin(time * 0.044 + seed.phase + pulse * 2.4) * spring;
      const recoil = state === 'lightning' ? Math.max(0, Math.sin(time * 0.13 + seed.phase)) * 18 * life : 0;
      const threadPull = Math.sin(time * 0.037 + seed.offset * TAU + mark.spin) * seed.slack * 9 * life;
      const x = cx + Math.cos(angle) * (orbit + tug + recoil + threadPull) * (1 + mood.pull * 0.18);
      const y = cy + Math.sin(angle) * (orbit * 0.62 + tug * 0.42 - recoil * 0.25 + threadPull * 0.22);
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
