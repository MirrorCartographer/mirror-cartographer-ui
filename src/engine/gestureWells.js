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
  if (kind === 'rain') return { pull: 0.62, spin: -1.2, wobble: 0.7, ring: 0.9, braid: 0.72, web: 0.78 };
  if (kind === 'wind') return { pull: 0.42, spin: 1.8, wobble: 1.25, ring: 1.18, braid: 1.35, web: 1.28 };
  if (kind === 'murmur') return { pull: 0.72, spin: 1.45, wobble: 1.05, ring: 1.35, braid: 1.2, web: 1.38 };
  if (kind === 'aurora') return { pull: 0.48, spin: 1.15, wobble: 1.4, ring: 1.28, braid: 1.45, web: 1.22 };
  if (kind === 'dawn') return { pull: 0.36, spin: 0.72, wobble: 0.8, ring: 0.78, braid: 0.9, web: 0.72 };
  if (kind === 'lightning') return { pull: 0.84, spin: -2.1, wobble: 1.7, ring: 0.66, braid: 1.7, web: 1.55 };
  return { pull: 0.4, spin: 0.9, wobble: 0.72, ring: 1, braid: 1, web: 1 };
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

function verletNode(ax, ay, bx, by, q, normal, sag, shiver, stiffness) {
  const tether = Math.sin(q * Math.PI);
  return {
    x: ax + (bx - ax) * q + normal.x * tether * sag + normal.y * shiver * stiffness,
    y: ay + (by - ay) * q + normal.y * tether * sag - normal.x * shiver * stiffness,
  };
}

function drawVerletTensionWeb(ctx, active, env) {
  const { width, height, time, pulse, rhythm, state, budget } = env;
  const nodeCount = Math.max(4, Math.min(budget.gestureWellThreadNodes || 7, budget.mobile ? 7 : 12));
  const webCount = Math.max(0, Math.min(active.length - 1, budget.mobile ? 2 : 4));
  if (webCount < 1 || pulse < 0.28) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < webCount; i += 1) {
    const a = active[active.length - 1 - i];
    const b = active[active.length - 2 - i];
    if (!a || !b) continue;

    const life = Math.max(0, 1 - Math.max(ageOf(a, 8400), ageOf(b, 8400)));
    if (life <= 0.03) continue;

    const ax = a.x * width;
    const ay = a.y * height;
    const bx = b.x * width;
    const by = b.y * height;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normal = { x: -dy / length, y: dx / length };
    const mood = wellMood(a.kind || state);
    const kind = a.kind || b.kind || state;
    const alpha = clamp((0.035 + pulse * 0.075 + rhythm * 0.012) * life, 0.025, budget.mobile ? 0.18 : 0.28);
    const sag = Math.min(width, height) * (0.018 + mood.web * 0.018) * life;
    const stiffness = (kind === 'lightning' ? 2.1 : kind === 'rain' ? 0.82 : 1.18) * mood.web;

    ctx.strokeStyle = colorFor(kind, alpha);
    ctx.shadowColor = colorFor(kind, 0.72);
    ctx.shadowBlur = budget.mobile ? 5 : 14;
    ctx.lineWidth = clamp(0.46 + pulse * 0.8 - i * 0.08, 0.34, budget.mobile ? 1 : 1.45);
    ctx.globalAlpha = 1;
    ctx.beginPath();

    for (let node = 0; node < nodeCount; node += 1) {
      const q = node / Math.max(1, nodeCount - 1);
      const wave = Math.sin(time * 0.06 + q * 8 + i * 1.7 + rhythm * 0.22);
      const snap = kind === 'lightning' ? Math.max(0, Math.sin(time * 0.18 + i * 3 + q * 5)) * 9 * life : 0;
      const shiver = wave * (3 + rhythm * 0.55 + snap) * life;
      const p = verletNode(ax, ay, bx, by, q, normal, sag, shiver, stiffness);
      if (node === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();

    if (!budget.mobile && i === 0) {
      ctx.globalAlpha = alpha * 0.48;
      ctx.beginPath();
      const beadCount = 3;
      for (let bead = 1; bead <= beadCount; bead += 1) {
        const q = bead / (beadCount + 1);
        const shiver = Math.sin(time * 0.075 + q * 10 + rhythm) * (5 + rhythm * 0.5) * life;
        const p = verletNode(ax, ay, bx, by, q, normal, sag, shiver, stiffness);
        ctx.moveTo(p.x + 1.2, p.y);
        ctx.arc(p.x, p.y, 1.2 + pulse * 1.2, 0, TAU);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawInductionArcs(ctx, active, env) {
  const { width, height, time, pulse, rhythm, state, budget } = env;
  const charged = state === 'lightning' || state === 'murmur' || rhythm > 3.2 || pulse > 0.72;
  const pairCount = Math.min(active.length - 1, budget.mobile ? 1 : 3);
  if (!charged || pairCount < 1) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let pair = 0; pair < pairCount; pair += 1) {
    const a = active[active.length - 1 - pair];
    const b = active[active.length - 2 - pair];
    if (!a || !b) continue;

    const life = Math.max(0, 1 - Math.max(ageOf(a, 4200), ageOf(b, 4200)));
    if (life < 0.08) continue;

    const ax = a.x * width;
    const ay = a.y * height;
    const bx = b.x * width;
    const by = b.y * height;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const kind = state === 'lightning' ? 'lightning' : a.kind || state;
    const branchCount = budget.mobile ? 1 : pair === 0 ? 3 : 2;
    const nodeCount = budget.mobile ? 5 : 8;
    const charge = clamp((pulse * 0.55 + rhythm * 0.075) * life, 0.06, budget.mobile ? 0.34 : 0.58);

    ctx.strokeStyle = colorFor(kind, charge);
    ctx.shadowColor = colorFor(kind, 0.9);
    ctx.shadowBlur = budget.mobile ? 8 : 22;

    for (let branch = 0; branch < branchCount; branch += 1) {
      const flicker = Math.max(0, Math.sin(time * 0.19 + branch * 2.7 + pair * 1.1));
      if (flicker < (state === 'lightning' ? 0.18 : 0.42)) continue;

      ctx.globalAlpha = charge * (0.38 + flicker * 0.62);
      ctx.lineWidth = clamp(0.38 + flicker * 1.3 - pair * 0.15, 0.32, budget.mobile ? 1.2 : 2.1);
      ctx.beginPath();

      for (let node = 0; node < nodeCount; node += 1) {
        const q = node / Math.max(1, nodeCount - 1);
        const tooth = Math.sin((q * 17 + branch * 5.3) * Math.PI) > 0 ? 1 : -1;
        const taper = Math.sin(q * Math.PI);
        const jitter = tooth * taper * (4 + rhythm * 1.4 + branch * 2.2) * (0.45 + flicker) * life;
        const crawl = Math.sin(time * 0.083 + q * 9 + branch + pair) * taper * (5 + pulse * 12) * life;
        const x = ax + dx * q + nx * (jitter + crawl);
        const y = ay + dy * q + ny * (jitter + crawl);
        if (node === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }

      ctx.stroke();

      if (!budget.mobile && branch === 0 && flicker > 0.62) {
        const q = 0.34 + Math.sin(time * 0.041 + pair) * 0.12;
        const fork = Math.sin(q * Math.PI) * (12 + rhythm * 2) * life;
        const fx = ax + dx * q + nx * fork;
        const fy = ay + dy * q + ny * fork;
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + nx * (18 + pulse * 24), fy + ny * (18 + pulse * 24));
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
  drawVerletTensionWeb(ctx, active, env);
  drawInductionArcs(ctx, active, env);
}
