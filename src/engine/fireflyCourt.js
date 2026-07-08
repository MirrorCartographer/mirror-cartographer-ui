const TAU = Math.PI * 2;

export function seedFireflyCourt(count) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: Math.random(),
    y: 0.18 + Math.random() * 0.62,
    vx: (Math.random() - 0.5) * 0.0012,
    vy: (Math.random() - 0.5) * 0.0012,
    phase: Math.random() * TAU,
    blink: Math.random(),
    role: i % 6,
    nerve: Math.random(),
    attention: 0,
    bow: 0,
    quorum: 0,
    pause: 0,
    turn: Math.random() * TAU,
    relay: 0,
    flinch: 0,
    perch: Math.random(),
  }));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function colorFor(state, spec) {
  if (state === 'rain') return '#9cdcff';
  if (state === 'aurora') return '#a7f3d0';
  if (state === 'murmur') return '#c4b5fd';
  if (state === 'dawn') return '#ffd1dc';
  if (state === 'lightning') return '#effbff';
  return spec.warmth > 0.7 ? '#ffe2bf' : '#fff0c7';
}

function stateBias(state) {
  if (state === 'wind') return { drift: 0.00032, gather: 0.000024, orbit: 0.009, scatter: 1.25, alignment: 0.000018, separation: 0.0016, hush: 0.02 };
  if (state === 'rain') return { drift: -0.00008, gather: 0.000038, orbit: 0.004, scatter: 0.72, alignment: 0.000012, separation: 0.0011, hush: 0.1 };
  if (state === 'lightning') return { drift: 0.00054, gather: 0.000018, orbit: 0.016, scatter: -1.6, alignment: 0.000006, separation: 0.0022, hush: -0.06 };
  if (state === 'murmur') return { drift: 0.00018, gather: 0.00006, orbit: 0.007, scatter: 1.6, alignment: 0.000028, separation: 0.0012, hush: 0.16 };
  return { drift: 0.00012, gather: 0.00004, orbit: 0.005, scatter: 1, alignment: 0.000016, separation: 0.0013, hush: 0.06 };
}

function courtBeat(t, rhythm, pulse, state) {
  const breath = Math.max(0, Math.sin(t * 0.018 - 0.7));
  const held = Math.max(0, Math.sin(t * 0.011 + Math.PI * 0.35));
  const startle = state === 'lightning' ? Math.max(0, Math.sin(t * 0.12)) ** 5 : 0;
  const murmur = state === 'murmur' ? Math.max(0, Math.sin(t * 0.032 + rhythm * 0.2)) : 0;
  const hush = Math.max(0, Math.sin(t * 0.006 + rhythm * 0.13)) ** 7;
  return {
    breath: breath * (0.35 + pulse * 0.5),
    held: held * 0.55,
    startle,
    murmur,
    hush,
  };
}

function neighborBudget(budget, count) {
  const stride = budget.mobile && count > 9 ? 2 : count > 32 ? 2 : 1;
  return {
    stride,
    maxNear: budget.mobile ? 5 : 9,
  };
}

function shouldSampleNeighbor(index, otherIndex, stride) {
  return stride === 1 || ((index + otherIndex) % stride === 0);
}

function emotionalRelay(index, active, beat, touched, state) {
  const prev = active[index - 1];
  const inherited = prev ? prev.relay * 0.58 : 0;
  const leaderCue = index === 0 ? Math.max(touched, beat.murmur * 0.7, beat.startle) : inherited;
  const stagger = Math.max(0, Math.sin(beat.hush * TAU + index * 0.72)) * 0.18;
  const stateCue = state === 'rain' ? 0.08 : state === 'aurora' ? 0.14 : 0;
  return clamp(leaderCue + stagger + stateCue, 0, 1);
}

function perchTarget(f, t, state) {
  const side = f.role % 2 === 0 ? -1 : 1;
  const drift = Math.sin(t * 0.0025 + f.phase) * 0.035;
  const crouch = state === 'lightning' ? -0.045 : state === 'rain' ? 0.035 : 0;
  return {
    x: 0.5 + side * (0.12 + f.perch * 0.16) + drift,
    y: 0.22 + f.role * 0.032 + crouch + Math.cos(t * 0.002 + f.nerve) * 0.018,
  };
}

function drawWingGlyph(ctx, radius, beat, bow, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(-radius * 1.9, bow * 1.8, radius * (2.1 + beat), radius * 0.8, -0.55, 0, TAU);
  ctx.ellipse(radius * 1.9, bow * 1.8, radius * (2.1 + beat), radius * 0.8, 0.55, 0, TAU);
  ctx.stroke();
}

function drawSentinelThread(ctx, from, to, w, h, color, strength, t) {
  ctx.globalAlpha = clamp(strength * 0.18, 0, 0.22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  const sx = from.x * w;
  const sy = from.y * h;
  const ex = to.x * w;
  const ey = to.y * h;
  const lift = Math.sin(t * 0.009 + from.phase) * 18 * strength;
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + ex) * 0.5, (sy + ey) * 0.5 - lift, ex, ey);
  ctx.stroke();
}

export function drawFireflyCourt(ctx, court, marks, options) {
  const { width: w, height: h, time: t, pulse, rhythm, state, spec, budget } = options;
  const active = court.slice(0, budget.fireflies);
  if (!active.length) return;

  const latest = marks.at(-1);
  const touched = latest ? Math.max(0, 1 - (Date.now() - latest.time) / 3200) : 0;
  const bias = stateBias(state);
  const color = colorFor(state, spec);
  const beat = courtBeat(t, rhythm, pulse, state);
  const leader = active[0];
  const cx = 0.5 + Math.sin(t * 0.004 + rhythm * 0.05) * 0.08;
  const cy = 0.44 + Math.cos(t * 0.003) * 0.05 + spec.warmth * 0.08;
  const quorumPulse = Math.max(0, Math.sin(t * 0.026 + rhythm * 0.28)) ** 6;
  const flockBudget = neighborBudget(budget, active.length);
  const sentinelMode = state === 'aurora' || state === 'murmur' || touched > 0.18;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  active.forEach((f, index) => {
    const rank = 1 - index / Math.max(1, active.length);
    const relay = emotionalRelay(index, active, beat, touched, state);
    f.relay = Math.max(f.relay || 0, relay);
    const leaderPull = leader && leader !== f ? { x: leader.x - f.x, y: leader.y - f.y } : { x: 0, y: 0 };
    const orbit = f.phase + t * bias.orbit * (0.35 + rank) + rhythm * 0.08;
    const perch = sentinelMode ? perchTarget(f, t, state) : null;
    const orbitX = cx + Math.cos(orbit + f.role) * (0.08 + f.role * 0.012 + pulse * 0.025 + beat.held * 0.012);
    const orbitY = cy + Math.sin(orbit * 1.7 + f.nerve) * (0.05 + f.role * 0.008 + beat.breath * 0.014);
    const targetX = perch ? perch.x * (0.28 + f.relay * 0.18) + orbitX * (0.72 - f.relay * 0.18) : orbitX;
    const targetY = perch ? perch.y * (0.22 + f.relay * 0.22) + orbitY * (0.78 - f.relay * 0.22) : orbitY;
    let ax = (targetX - f.x) * bias.gather + leaderPull.x * 0.000012;
    let ay = (targetY - f.y) * bias.gather + leaderPull.y * 0.000012;

    let near = 0;
    let avgVx = 0;
    let avgVy = 0;
    let repelX = 0;
    let repelY = 0;
    for (let otherIndex = 0; otherIndex < active.length; otherIndex += 1) {
      const other = active[otherIndex];
      if (other === f || !shouldSampleNeighbor(index, otherIndex, flockBudget.stride)) continue;
      const dx = other.x - f.x;
      const dy = other.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.000001 && d2 < 0.018) {
        near += 1;
        avgVx += other.vx;
        avgVy += other.vy;
        if (d2 < 0.0024) {
          const push = 1 / Math.max(0.0005, d2);
          repelX -= dx * push;
          repelY -= dy * push;
        }
        if (near >= flockBudget.maxNear) break;
      }
    }

    if (near) {
      ax += ((avgVx / near) - f.vx) * bias.alignment;
      ay += ((avgVy / near) - f.vy) * bias.alignment;
      ax += repelX * bias.separation * 0.000001;
      ay += repelY * bias.separation * 0.000001;
      f.quorum = Math.max(f.quorum, Math.min(1, near / flockBudget.maxNear) * (0.22 + quorumPulse * 0.72));
    }

    if (latest) {
      const dx = latest.x - f.x;
      const dy = latest.y - f.y;
      const d = Math.max(0.018, Math.hypot(dx, dy));
      const shy = latest.kind === 'lightning' || latest.kind === 'wind';
      const intent = shy ? -1 : 1;
      ax += (dx / d) * touched * intent * bias.scatter * (0.00038 + rank * 0.00016);
      ay += (dy / d) * touched * intent * bias.scatter * (0.00032 + rank * 0.00012);
      f.attention = Math.max(f.attention, touched * (shy ? 0.55 : 1));
      f.bow = Math.max(f.bow, touched * (shy ? 0.16 : 0.64));
      f.pause = Math.max(f.pause, touched * (shy ? 0.04 : 0.28 + rank * 0.16));
      f.flinch = Math.max(f.flinch || 0, touched * (shy ? 0.76 : 0.18));
    }

    f.attention *= 0.974;
    f.bow *= 0.986;
    f.quorum *= 0.966;
    f.pause *= 0.972;
    f.relay *= 0.942;
    f.flinch = (f.flinch || 0) * 0.936;
    f.turn += 0.012 + f.quorum * 0.025 + beat.startle * 0.16 + f.relay * 0.018;
    ax += Math.sin(t * 0.013 + f.phase + f.turn) * bias.drift;
    ay += Math.cos(t * 0.011 + f.phase * 1.3) * bias.drift * 0.7;
    const brake = clamp(0.982 - f.pause * bias.hush - beat.held * 0.025 - f.relay * 0.018, 0.88, 0.992);
    f.vx = clamp((f.vx + ax) * brake, -0.0042, 0.0042);
    f.vy = clamp((f.vy + ay) * brake, -0.0036, 0.0036);
    f.x += f.vx * budget.motionScale;
    f.y += f.vy * budget.motionScale;
    if (f.x < -0.04) f.x = 1.04;
    if (f.x > 1.04) f.x = -0.04;
    f.y = clamp(f.y, 0.08, 0.88);

    const x = f.x * w;
    const y = (f.y + f.bow * 0.018 + f.pause * 0.004 - f.relay * 0.01 + f.flinch * 0.016) * h;
    const cadence = Math.sin(t * (0.045 + rank * 0.035) + f.phase + leader.blink * 2.4 + f.quorum * 1.7 + f.relay * 1.2);
    const blink = Math.max(0, cadence) ** 3;
    const held = f.attention * (0.35 + pulse * 0.55);
    const performed = beat.breath + f.quorum * 0.7 + beat.murmur * (index % 3 === 0 ? 0.65 : 0.25) + f.relay * 0.5;
    const flare = 0.08 + blink * (0.42 + pulse * 0.28) + held * 0.36 + performed * 0.16 + beat.startle * 0.24;
    const radius = 1.3 + rank * 2.1 + held * 3.2 + f.quorum * 1.4 + f.relay * 1.1;

    if (!budget.mobile && index > 0 && index % 2 === 0 && (f.relay > 0.14 || f.quorum > 0.24)) {
      drawSentinelThread(ctx, active[index - 1], f, w, h, color, f.relay + f.quorum * 0.45, t);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(f.vy, f.vx || 0.0001) + Math.sin(t * 0.01 + f.phase) * 0.35 + f.quorum * 0.28 + f.flinch * 0.45);
    ctx.globalAlpha = clamp(flare, 0.04, 0.86);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + blink * 28 + held * 28 + performed * 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();

    ctx.globalAlpha *= budget.mobile ? 0.22 : 0.36;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (5 + f.bow * 2 + f.quorum + f.relay), radius * (1.4 + blink + beat.breath * 0.5 + f.flinch * 0.5), 0, 0, TAU);
    ctx.stroke();

    if (!budget.mobile && (f.quorum > 0.18 || f.attention > 0.18 || f.relay > 0.16 || state === 'murmur')) {
      ctx.globalAlpha *= 0.62;
      drawWingGlyph(ctx, radius, performed, f.bow + f.flinch * 0.2, color);
    }

    if (!budget.mobile && (f.attention > 0.12 || state === 'murmur') && index % 3 === 0) {
      ctx.globalAlpha *= 0.44;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-18 * rank, Math.sin(t * 0.03 + f.phase) * 18, -36 * rank, 4 + f.bow * 18 + f.quorum * 12 + f.relay * 10);
      ctx.stroke();
    }
    ctx.restore();
  });

  ctx.restore();
}
