const TAU = Math.PI * 2;
const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const lerp = (a, b, t) => a + (b - a) * t;
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

function makeRope(ropeIndex, nodeCount = 9) {
  return {
    rest: 0.05 + ropeIndex * 0.006,
    nodes: Array.from({ length: nodeCount }, (_, nodeIndex) => {
      const x = 0.18 + ropeIndex * 0.13 + nodeIndex * 0.036;
      const y = 0.28 + ropeIndex * 0.045 + wave(nodeIndex, 0.9, ropeIndex) * 0.03;
      return { x, y, oldX: x, oldY: y };
    })
  };
}

function makeEddy(i) {
  return {
    i,
    x: 0.12 + ((i * 37) % 83) / 100,
    y: 0.16 + ((i * 53) % 67) / 100,
    phase: Math.sin((i + 1) * 12.9898) * 43758.5453,
    spin: i % 2 ? -1 : 1,
    reach: 0.17 + ((i * 19) % 40) / 180,
    strength: 0.35 + ((i * 29) % 60) / 100
  };
}

export function createCreatureWeather() {
  return {
    swarm: Array.from({ length: 30 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: 0.4 + Math.random() * 1.4, r: 0.8 + Math.random() * 2.2 })),
    flock: Array.from({ length: 20 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: 0.5 + Math.random(), k: 0.7 + Math.random() * 1.3 })),
    clouds: Array.from({ length: 5 }, (_, i) => ({ i, x: Math.random(), y: 0.1 + Math.random() * 0.3, p: Math.random() * TAU, k: 0.8 + Math.random() })),
    sprites: Array.from({ length: 7 }, (_, i) => ({ i, x: Math.random(), y: Math.random(), p: Math.random() * TAU, k: 0.7 + Math.random() * 1.2 })),
    ropes: Array.from({ length: 5 }, (_, i) => makeRope(i)),
    eddies: Array.from({ length: 6 }, (_, i) => makeEddy(i))
  };
}

function mood(state, pulse, rhythm) {
  return {
    speed: (state === 'wind' || state === 'lightning' || state === 'murmur' ? 1.35 : 0.85) + pulse * 0.45 + rhythm * 0.035,
    gather: state === 'clear' ? 1.25 : state === 'wind' ? 0.68 : state === 'murmur' ? 1.15 : 0.9,
    alarm: state === 'lightning' ? 1.45 : state === 'rain' ? 0.9 : 0.55,
    beat: state === 'lightning' ? 1.9 : state === 'wind' ? 1.45 : state === 'rain' ? 0.82 : 1,
    curiosity: state === 'murmur' || state === 'aurora' ? 1.25 : 0.85
  };
}

function emotionalCue(time, state, pulse, rhythm) {
  const inhale = (wave(time, 0.028, rhythm * 0.19) + 1) / 2;
  const quick = Math.max(0, wave(time, state === 'lightning' ? 0.17 : 0.064, pulse * 4));
  return {
    inhale,
    startle: state === 'lightning' ? quick : quick * Math.max(0, pulse - 0.55),
    hush: state === 'rain' ? 0.65 + inhale * 0.35 : 1,
    bloom: state === 'dawn' || state === 'aurora' ? 0.6 + inhale * 0.5 : 0.35 + pulse * 0.35
  };
}

function targetFor(active, state, time, ropeIndex = 0) {
  const mark = active[active.length - 1 - (ropeIndex % Math.max(1, active.length))];
  if (mark) return { x: mark.x, y: mark.y, kind: mark.kind || state, awake: true };
  return { x: 0.5 + wave(time, 0.006, ropeIndex * 1.7) * 0.22, y: 0.5 + wave(time, 0.004, ropeIndex) * 0.16, kind: state, awake: false };
}

function flowAt(ecology, x, y, env, m, cue) {
  const { time: t, active, state, pulse, rhythm, budget } = env;
  const count = Math.min(ecology.eddies?.length || 0, budget.mobile ? 4 : 6);
  let vx = state === 'wind' ? 0.012 + pulse * 0.006 : state === 'rain' ? -0.002 : 0;
  let vy = state === 'rain' ? 0.012 + pulse * 0.006 : state === 'dawn' ? -0.004 : 0;
  for (let i = 0; i < count; i += 1) {
    const e = ecology.eddies[i];
    const cx = clamp01(e.x + wave(t, 0.003 + i * 0.0004, e.phase) * 0.08 + (active.at(-1)?.x - 0.5 || 0) * 0.035);
    const cy = clamp01(e.y + wave(t, 0.0024 + i * 0.0003, e.phase * 0.7) * 0.07 + (active.at(-1)?.y - 0.5 || 0) * 0.028);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy + 0.0008;
    const reach = e.reach * (state === 'murmur' ? 1.28 : state === 'clear' ? 0.78 : 1);
    const pull = Math.max(0, 1 - d2 / (reach * reach)) * e.strength;
    const spin = e.spin * (state === 'lightning' ? 1.7 : state === 'wind' ? 1.25 : 0.92);
    vx += (-dy * spin + dx * 0.22 * m.curiosity) * pull * 0.05;
    vy += (dx * spin + dy * 0.18 * cue.bloom) * pull * 0.05;
  }
  vx += wave(t, 0.011, x * 8 + rhythm) * 0.006 * m.alarm;
  vy += wave(t, 0.009, y * 9 + pulse * 3) * 0.005 * m.speed;
  return { x: clamp(vx, -0.055, 0.055), y: clamp(vy, -0.055, 0.055) };
}

function drawWeatherCurrents(ctx, ecology, env, m, cue, target) {
  const { width: w, height: h, time: t, budget, state, pulse, rhythm } = env;
  const count = Math.min(ecology.eddies?.length || 0, budget.mobile ? 3 : 6);
  if (!count || (pulse < 0.26 && state !== 'wind' && state !== 'murmur' && state !== 'aurora')) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colorFor(target.kind || state, budget.mobile ? 0.09 + pulse * 0.045 : 0.12 + pulse * 0.075);
  ctx.shadowColor = colorFor(target.kind || state, 0.54);
  ctx.shadowBlur = budget.mobile ? 4 : 11;
  ctx.lineWidth = budget.mobile ? 0.52 + pulse * 0.35 : 0.65 + pulse * 0.62;
  for (let i = 0; i < count; i += 1) {
    const e = ecology.eddies[i];
    const cx = clamp01(e.x + wave(t, 0.003 + i * 0.0004, e.phase) * 0.08 + (target.x - 0.5) * 0.04);
    const cy = clamp01(e.y + wave(t, 0.0024 + i * 0.0003, e.phase * 0.7) * 0.07 + (target.y - 0.5) * 0.03);
    const radius = Math.min(w, h) * e.reach * (0.54 + cue.inhale * 0.18 + pulse * 0.12);
    ctx.globalAlpha = (budget.mobile ? 0.22 : 0.34) * cue.hush;
    ctx.beginPath();
    for (let n = 0; n <= 38; n += 1) {
      const q = n / 38;
      const a = e.phase + q * TAU * (0.72 + e.strength * 0.5) + t * 0.009 * e.spin * m.speed;
      const curl = radius * q * (0.45 + Math.sin(q * TAU + t * 0.017 + rhythm) * 0.07);
      const x = cx * w + Math.cos(a) * curl;
      const y = cy * h + Math.sin(a) * curl * (0.62 + pulse * 0.16);
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCloudBeasts(ctx, ecology, env, m, cue, target) {
  const { width: w, height: h, time: t, budget, state, pulse } = env;
  ecology.clouds.slice(0, budget.mobile ? 2 : 5).forEach((c) => {
    const drift = flowAt(ecology, c.x, c.y, env, m, cue);
    const x = ((c.x + drift.x * 0.16 + t * 0.00028 * m.speed + wave(t, 0.004, c.p) * 0.035 + target.x * 0.012 * m.curiosity + 1) % 1) * w;
    const y = clamp01(c.y + drift.y * 0.12 + wave(t, 0.006, c.p) * 0.035 + target.y * 0.012) * h;
    const size = Math.min(w, h) * 0.058 * c.k * (1 + pulse * 0.14 + cue.inhale * 0.08);
    const kind = state === 'cloud' ? target.kind || state : state;
    ctx.globalAlpha = 0.1 + pulse * 0.11 + cue.bloom * 0.05;
    ctx.fillStyle = colorFor(kind, 0.2);
    ctx.shadowColor = colorFor(kind, 0.8);
    ctx.shadowBlur = budget.mobile ? 9 : 18;
    ctx.beginPath();
    for (let lobe = 0; lobe < 7; lobe += 1) {
      const angle = (lobe / 7) * TAU + t * 0.002 * m.beat + wave(t, 0.01, c.p + lobe) * 0.04;
      const lx = x + Math.cos(angle) * size * (0.32 + (lobe % 3) * 0.14);
      const ly = y + Math.sin(angle * 1.7) * size * 0.22;
      ctx.moveTo(lx + size * 0.3, ly);
      ctx.arc(lx, ly, size * (0.28 + (lobe % 4) * 0.05), 0, TAU);
    }
    ctx.fill();
    if (!budget.mobile && (state === 'murmur' || pulse > 0.68)) {
      ctx.globalAlpha = 0.12 + cue.startle * 0.16;
      ctx.strokeStyle = colorFor(kind, 0.34);
      ctx.lineWidth = 0.7 + pulse * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.34, y + size * 0.05);
      ctx.quadraticCurveTo(x, y + size * (0.16 + cue.inhale * 0.12), x + size * 0.34, y + size * 0.03);
      ctx.stroke();
    }
  });
}

function drawTethers(ctx, ecology, env, m, cue) {
  const { width: w, height: h, time: t, active, budget, state, pulse, rhythm } = env;
  const ropes = ecology.ropes || [];
  const count = Math.min(ropes.length, budget.mobile ? 3 : ropes.length);
  const fall = (state === 'rain' ? 0.00042 : state === 'wind' ? -0.00008 : 0.00016) * (1 + pulse * 0.8);
  const drift = (state === 'wind' || state === 'murmur' ? 0.00072 : 0.00022) * wave(t, 0.018, rhythm * 0.2);
  for (let r = 0; r < count; r += 1) {
    const rope = ropes[r];
    const nodes = rope.nodes;
    const anchor = targetFor(active, state, t, r);
    const current = flowAt(ecology, nodes[0].x, nodes[0].y, env, m, cue);
    nodes[0].x += (anchor.x - nodes[0].x) * (anchor.awake ? 0.42 : 0.055) + current.x * 0.04;
    nodes[0].y += (anchor.y - nodes[0].y) * (anchor.awake ? 0.42 : 0.055) + current.y * 0.04;
    nodes[0].oldX = nodes[0].x;
    nodes[0].oldY = nodes[0].y;
    for (let i = 1; i < nodes.length; i += 1) {
      const node = nodes[i];
      const flow = flowAt(ecology, node.x, node.y, env, m, cue);
      const vx = (node.x - node.oldX) * 0.985;
      const vy = (node.y - node.oldY) * 0.985;
      node.oldX = node.x;
      node.oldY = node.y;
      node.x = clamp(node.x + vx + drift * (i / nodes.length) + flow.x * 0.018 + wave(t, 0.013, i + r) * 0.00016, -0.08, 1.08);
      node.y = clamp(node.y + vy + fall + flow.y * 0.018 + wave(t, 0.011, i * 1.7) * 0.00012, -0.08, 1.08);
    }
    for (let pass = 0; pass < (budget.mobile ? 2 : 3); pass += 1) {
      for (let i = 1; i < nodes.length; i += 1) {
        const a = nodes[i - 1];
        const b = nodes[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(0.0001, Math.hypot(dx, dy));
        const diff = (distance - rope.rest) / distance;
        const stiffness = 0.52 + pulse * 0.12;
        if (i > 1) {
          a.x += dx * diff * stiffness * 0.5;
          a.y += dy * diff * stiffness * 0.5;
        }
        b.x -= dx * diff * stiffness * 0.5;
        b.y -= dy * diff * stiffness * 0.5;
      }
    }
    const life = anchor.awake ? 1 : 0.58;
    ctx.strokeStyle = colorFor(anchor.kind, 0.14 + pulse * 0.22 + rhythm * 0.012);
    ctx.shadowColor = colorFor(anchor.kind, 0.78);
    ctx.shadowBlur = budget.mobile ? 7 : 18;
    ctx.lineWidth = Math.max(0.65, Math.min(w, h) * (budget.mobile ? 0.0016 : 0.0022) * (1 + pulse * 0.45));
    ctx.globalAlpha = life * (0.48 + pulse * 0.32);
    ctx.beginPath();
    nodes.forEach((node, i) => {
      const x = node.x * w;
      const y = node.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prev = nodes[i - 1];
        const cx = (prev.x + node.x) * 0.5 * w + wave(t, 0.018, i + r) * (2 + rhythm * 0.25);
        const cy = (prev.y + node.y) * 0.5 * h + wave(t, 0.016, i) * (2 + pulse * 4);
        ctx.quadraticCurveTo(cx, cy, x, y);
      }
    });
    ctx.stroke();
    if (!budget.mobile) {
      ctx.fillStyle = colorFor(anchor.kind, 0.35 + pulse * 0.2);
      nodes.forEach((node, i) => {
        if (i % 2 === 0) return;
        const beat = Math.max(0, wave(t, 0.05, i * 1.2 + r));
        ctx.globalAlpha = life * (0.06 + beat * 0.18);
        ctx.beginPath();
        ctx.arc(node.x * w, node.y * h, 1.2 + beat * 2.4 + pulse * 1.8, 0, TAU);
        ctx.fill();
      });
    }
  }
}

function drawFlock(ctx, ecology, env, m, cue, target) {
  const { width: w, height: h, time: t, budget, state, pulse, rhythm } = env;
  const count = Math.min(ecology.flock.length, budget.mobile ? 10 : 20);
  ecology.flock.slice(0, count).forEach((b, i) => {
    const q = i / Math.max(1, count - 1);
    const phase = b.p + t * 0.0063 * b.s * m.speed;
    const orbit = (0.07 + q * 0.16 * m.gather) * (1 + cue.startle * 0.22);
    const leap = state === 'lightning' ? wave(t, 0.049, b.i) * 0.045 : 0;
    const draft = flowAt(ecology, target.x + Math.cos(phase) * orbit, target.y + Math.sin(phase) * orbit * 0.58, env, m, cue);
    const xNorm = clamp01(target.x + Math.cos(phase) * orbit + draft.x * 0.85 + wave(t, 0.017, b.i) * 0.03 * m.alarm + leap);
    const yNorm = clamp01(target.y + Math.sin(phase * 0.86) * orbit * 0.58 + draft.y * 0.85 + Math.cos(phase * 1.3) * 0.04 - cue.startle * 0.025);
    const body = Math.min(w, h) * 0.006 * b.k;
    const face = Math.atan2(target.y + draft.y - yNorm, target.x + draft.x - xNorm);
    const wing = Math.sin(t * 0.14 * m.beat + b.i) * (5 + rhythm * 0.45 + cue.startle * 9) * b.k;
    ctx.save();
    ctx.translate(xNorm * w, yNorm * h);
    ctx.rotate(face + Math.PI + wave(t, 0.02, b.p) * 0.12);
    ctx.strokeStyle = colorFor(target.kind || state, 0.2 + pulse * 0.22);
    ctx.fillStyle = colorFor(target.kind || state, 0.16 + pulse * 0.16);
    ctx.shadowColor = colorFor(target.kind || state, 0.9);
    ctx.shadowBlur = budget.mobile ? 5 : 12;
    ctx.globalAlpha = (0.42 + pulse * 0.28) * cue.hush;
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
}

function drawFireflies(ctx, ecology, env, m, cue, target) {
  const { width: w, height: h, time: t, budget, state, pulse } = env;
  const count = Math.min(ecology.swarm.length, budget.mobile ? 16 : 30);
  ecology.swarm.slice(0, count).forEach((f, i) => {
    const q = i / Math.max(1, count - 1);
    const blink = Math.max(0, Math.sin(t * 0.052 * m.beat + f.p + q * 4));
    const radius = (0.07 + q * 0.2) * (1 + pulse * 0.25 + cue.inhale * 0.1);
    const baseX = lerp(f.x, target.x, 0.42) + Math.cos(t * 0.011 * f.s + f.p) * radius;
    const baseY = lerp(f.y, target.y, 0.38) + Math.sin(t * 0.014 * f.s + f.p * 1.4) * radius * 0.62;
    const draft = flowAt(ecology, baseX, baseY, env, m, cue);
    const x = clamp01(baseX + draft.x * 0.72 + cue.startle * wave(t, 0.043, i) * 0.035) * w;
    const y = clamp01(baseY + draft.y * 0.72) * h;
    ctx.globalAlpha = 0.07 + blink * (0.2 + pulse * 0.18) + cue.bloom * 0.04;
    ctx.fillStyle = colorFor(target.kind || state, 0.72);
    ctx.shadowColor = colorFor(target.kind || state, 1);
    ctx.shadowBlur = 7 + blink * 17;
    ctx.beginPath();
    ctx.arc(x, y, f.r + blink * (1.4 + pulse * 2), 0, TAU);
    ctx.fill();
  });
}

function drawStormSprites(ctx, ecology, env, m, cue, target) {
  const { width: w, height: h, time: t, budget, state, pulse, rhythm } = env;
  const charged = state === 'lightning' || state === 'murmur' || rhythm > 4 || pulse > 0.72;
  if (!charged) return;
  const count = Math.min(ecology.sprites.length, budget.mobile ? 3 : 7);
  ecology.sprites.slice(0, count).forEach((s, i) => {
    const phase = s.p + t * (0.018 + i * 0.001) * m.speed;
    const jump = cue.startle * (0.08 + s.k * 0.025);
    const baseX = lerp(s.x, target.x, 0.3) + Math.cos(phase * 1.2) * (0.18 + jump);
    const baseY = lerp(s.y, target.y, 0.26) + Math.sin(phase) * (0.1 + jump * 0.6);
    const draft = flowAt(ecology, baseX, baseY, env, m, cue);
    const x = clamp01(baseX + draft.x * 0.48) * w;
    const y = clamp01(baseY + draft.y * 0.48) * h;
    const scale = Math.min(w, h) * 0.018 * s.k * (1 + cue.startle * 0.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase + cue.startle * 0.7 + Math.atan2(draft.y, draft.x) * 0.35);
    ctx.strokeStyle = colorFor(state === 'lightning' ? 'lightning' : target.kind || state, 0.18 + pulse * 0.18 + cue.startle * 0.22);
    ctx.shadowColor = colorFor(state === 'lightning' ? 'lightning' : target.kind || state, 0.9);
    ctx.shadowBlur = budget.mobile ? 8 : 20;
    ctx.lineWidth = 0.7 + cue.startle * 1.3;
    ctx.globalAlpha = 0.42 + cue.startle * 0.42;
    ctx.beginPath();
    for (let n = 0; n < 5; n += 1) {
      const angle = (n / 5) * TAU;
      const r = scale * (n % 2 ? 0.52 : 1.15);
      if (n === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

function drawWaterEchoes(ctx, env) {
  const { width: w, height: h, time: t, active, budget, state, pulse } = env;
  if (state !== 'rain' && state !== 'murmur' && pulse <= 0.5) return;
  ctx.strokeStyle = colorFor(state === 'rain' ? 'rain' : 'murmur', 0.18 + pulse * 0.12);
  ctx.lineWidth = 0.7 + pulse * 0.6;
  active.slice(-(budget.mobile ? 5 : 8)).forEach((mark, i) => {
    const age = Math.min(1, (Date.now() - mark.time) / 5200);
    const life = 1 - age;
    if (life <= 0.02) return;
    const base = Math.min(w, h) * (0.025 + age * 0.22);
    ctx.globalAlpha = life * 0.34;
    ctx.beginPath();
    ctx.ellipse(mark.x * w, h * (0.72 + Math.sin(t * 0.006 + i) * 0.03), base * 1.6, base * 0.22, 0, 0, TAU);
    ctx.stroke();
    if (!budget.mobile && i < 3) {
      ctx.globalAlpha = life * 0.09;
      ctx.beginPath();
      ctx.ellipse(mark.x * w, mark.y * h, base * 0.7, base * 0.2, Math.sin(t * 0.01 + i), 0, TAU);
      ctx.stroke();
    }
  });
}

export function drawCreatureWeather(ctx, ecology, env) {
  const { time: t, active, state, pulse, rhythm } = env;
  const m = mood(state, pulse, rhythm);
  const target = active.at(-1) || { x: 0.5 + Math.sin(t * 0.006) * 0.22, y: 0.54 + Math.cos(t * 0.004) * 0.16, kind: state };
  const cue = emotionalCue(t, state, pulse, rhythm);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  drawWeatherCurrents(ctx, ecology, env, m, cue, target);
  drawCloudBeasts(ctx, ecology, env, m, cue, target);
  drawTethers(ctx, ecology, env, m, cue);
  drawFlock(ctx, ecology, env, m, cue, target);
  drawStormSprites(ctx, ecology, env, m, cue, target);
  drawFireflies(ctx, ecology, env, m, cue, target);
  drawWaterEchoes(ctx, env);
  ctx.restore();
}
