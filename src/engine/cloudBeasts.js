const TAU = Math.PI * 2;

export function seedCloudBeasts(count) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: 0.12 + Math.random() * 0.76,
    y: 0.14 + Math.random() * 0.42,
    vx: (Math.random() - 0.5) * 0.00055,
    vy: (Math.random() - 0.5) * 0.00038,
    scale: 0.58 + Math.random() * 0.86,
    phase: Math.random() * TAU,
    attention: 0,
    recoil: 0,
    bloom: 0,
    curiosity: Math.random() * 0.65,
    crouch: 0,
    tail: 0,
  }));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function beastTint(state, spec) {
  if (state === 'rain') return '145,216,255';
  if (state === 'aurora') return '167,243,208';
  if (state === 'murmur') return '196,181,253';
  if (state === 'dawn') return '255,209,220';
  if (state === 'lightning') return '239,251,255';
  return spec.warmth > 0.62 ? '255,226,191' : '247,251,255';
}

function performBeat(time, phase, rhythm, state) {
  const slow = Math.sin(time * 0.011 + phase);
  const inhale = Math.max(0, Math.sin(time * 0.018 + phase * 0.7));
  const listening = Math.max(0, Math.sin(time * 0.031 + phase + rhythm * 0.08));
  const stormFlinch = state === 'lightning' ? Math.max(0, Math.sin(time * 0.19 + phase * 3.1)) : 0;
  return {
    inhale,
    listening,
    pause: Math.max(0, 1 - Math.abs(slow) * 2.6),
    stormFlinch,
  };
}

export function drawCloudBeasts(ctx, beasts, marks, options) {
  const { width: w, height: h, time: t, pulse, rhythm, state, spec, budget } = options;
  const limit = budget.cloudBeasts || (budget.mobile ? 5 : beasts.length);
  const active = beasts.slice(0, limit);
  const latest = marks.at(-1);
  const fresh = latest ? Math.max(0, 1 - (Date.now() - latest.time) / 3200) : 0;
  const tint = beastTint(state, spec);
  const herdCenterX = 0.5 + Math.sin(t * 0.003) * 0.08;
  const herdCenterY = 0.26 + Math.cos(t * 0.004) * 0.045 + spec.warmth * 0.08;
  const weatherDrift = state === 'wind' || state === 'murmur' ? 0.00032 : state === 'rain' ? -0.00008 : 0.00008;
  const peerLimit = budget.mobile ? Math.min(active.length, 5) : active.length;
  const lobeCount = budget.ultraTiny ? 3 : budget.tiny ? 4 : 5;
  const tendrilCount = budget.mobile ? 0 : state === 'murmur' ? 4 : 2;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  active.forEach((b, i) => {
    const beat = performBeat(t, b.phase, rhythm, state);
    const blink = Math.max(0, Math.sin(t * 0.052 + b.phase * 2.7));
    const patrolX = herdCenterX + Math.sin(t * 0.004 + b.phase + i * 0.33) * (0.05 + b.curiosity * 0.04);
    const patrolY = herdCenterY + Math.cos(t * 0.003 + b.phase * 0.8) * (0.035 + b.curiosity * 0.025);
    let ax = (patrolX - b.x) * 0.000018 + Math.sin(t * 0.007 + b.phase) * weatherDrift;
    let ay = (patrolY - b.y) * 0.000016 + Math.cos(t * 0.006 + b.phase) * weatherDrift * 0.55;

    active.slice(0, peerLimit).forEach((other, j) => {
      if (i === j) return;
      const dx = other.x - b.x;
      const dy = other.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.006) {
        ax -= dx * 0.00018;
        ay -= dy * 0.00018;
      }
      if (d2 > 0.018 && d2 < 0.07) {
        ax += dx * 0.000012;
        ay += dy * 0.000008;
      }
      if (!budget.mobile && d2 > 0.012 && d2 < 0.035 && beat.listening > 0.72) {
        const tether = Math.sin(t * 0.018 + i + j) * 0.000018;
        ax += dx * tether;
        ay += dy * tether;
      }
    });

    if (latest) {
      const dx = latest.x - b.x;
      const dy = latest.y - b.y;
      const d = Math.max(0.025, Math.hypot(dx, dy));
      const storm = latest.kind === 'lightning' || latest.kind === 'wind';
      const force = fresh * (storm ? -0.00046 : 0.00034);
      ax += (dx / d) * force;
      ay += (dy / d) * force;
      b.attention = Math.max(b.attention, fresh * (storm ? 0.45 : 1));
      b.recoil = Math.max(b.recoil, fresh * (storm ? 1 : 0.28));
      b.bloom = Math.max(b.bloom, fresh * (state === 'dawn' || latest.kind === 'murmur' ? 1 : 0.58));
      b.crouch = Math.max(b.crouch, fresh * (storm ? 1 : 0.38));
      b.tail = Math.max(b.tail, fresh * (storm ? 0.35 : 1));
    }

    b.attention *= 0.986;
    b.recoil *= 0.972;
    b.bloom *= 0.982;
    b.crouch *= 0.976;
    b.tail *= 0.988;
    const hush = beat.pause * (0.18 + b.attention * 0.26);
    b.vx = clamp((b.vx + ax) * (0.985 - hush * 0.08), -0.0028, 0.0028);
    b.vy = clamp((b.vy + ay) * (0.986 - hush * 0.08), -0.002, 0.002);
    b.x += b.vx * (1 - beat.stormFlinch * 0.35);
    b.y += b.vy * (1 - beat.stormFlinch * 0.35);
    if (b.x < -0.12) b.x = 1.12;
    if (b.x > 1.12) b.x = -0.12;
    b.y = clamp(b.y, 0.08, 0.68);

    const x = b.x * w;
    const y = b.y * h;
    const bodyScale = 1 + b.bloom * 0.22 + beat.inhale * 0.07 - b.crouch * 0.12 + beat.stormFlinch * 0.08;
    const size = (26 + b.scale * 46) * bodyScale;
    const bow = b.attention * 7 - b.recoil * 11 + beat.pause * 5;
    const lean = Math.atan2(b.vy, b.vx || 0.00001) * 0.12 + Math.sin(t * 0.009 + b.phase) * 0.12 + b.recoil * 0.08;

    ctx.save();
    ctx.translate(x, y + bow);
    ctx.rotate(lean);
    ctx.scale(1 + beat.inhale * 0.04, 1 - b.crouch * 0.08 + beat.pause * 0.03);
    ctx.globalAlpha = (0.07 + pulse * 0.11 + b.attention * 0.16 + b.bloom * 0.08) * (budget.mobile ? 0.82 : 1);
    ctx.fillStyle = `rgba(${tint},0.62)`;
    ctx.strokeStyle = `rgba(${tint},0.88)`;
    ctx.shadowColor = `rgba(${tint},1)`;
    ctx.shadowBlur = budget.ultraTiny ? 8 + pulse * 10 : budget.tiny ? 12 + pulse * 14 : 18 + pulse * 22 + b.bloom * 18;

    if (tendrilCount && (b.tail > 0.08 || beat.listening > 0.58 || state === 'murmur')) {
      ctx.save();
      ctx.globalAlpha *= 0.3 + b.tail * 0.22 + beat.listening * 0.18;
      ctx.lineWidth = 0.75 + b.tail * 0.65;
      for (let k = 0; k < tendrilCount; k += 1) {
        const side = k % 2 === 0 ? -1 : 1;
        const offset = (k - (tendrilCount - 1) / 2) * size * 0.09;
        ctx.beginPath();
        ctx.moveTo(-size * 0.34 + offset, size * 0.06);
        for (let p = 1; p <= 6; p += 1) {
          const q = p / 6;
          const tx = -size * (0.38 + q * (0.35 + b.tail * 0.22));
          const ty = Math.sin(t * 0.033 + b.phase + q * 4 + k) * size * 0.08 + side * q * size * 0.16;
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const a = lobe * 1.22 + b.phase * 0.3 + beat.stormFlinch * 0.32;
      const lx = Math.cos(a) * size * 0.32;
      const ly = Math.sin(a * 1.4) * size * 0.15;
      ctx.beginPath();
      ctx.ellipse(lx, ly, size * (0.26 + lobe * 0.018), size * (0.16 + ((lobe + i) % 3) * 0.025), 0, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha *= 0.7 + blink * 0.3;
    ctx.lineWidth = 0.8 + b.attention * 0.8;
    ctx.beginPath();
    for (let p = 0; p <= 7; p += 1) {
      const q = p / 7;
      const px = -size * 0.43 + q * size * 0.86;
      const py = Math.sin(q * Math.PI * 2 + t * 0.026 + b.phase) * (4 + b.attention * 8) + b.recoil * Math.sin(q * Math.PI) * 10 - beat.pause * Math.sin(q * Math.PI) * 3;
      if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (!budget.mobile && (b.attention > 0.18 || state === 'murmur' || beat.pause > 0.72)) {
      ctx.globalAlpha *= 0.34;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.72 + b.bloom * 0.4 + beat.pause * 0.16), 0, TAU);
      ctx.stroke();
    }

    if (!budget.ultraTiny && (b.attention > 0.22 || beat.listening > 0.82)) {
      ctx.globalAlpha = (0.08 + b.attention * 0.16 + beat.listening * 0.08) * (budget.mobile ? 0.58 : 1);
      ctx.fillStyle = `rgba(255,248,239,0.82)`;
      ctx.beginPath();
      ctx.arc(size * 0.18, -size * 0.03, 1.4 + b.attention * 2.2, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  });

  ctx.restore();
}
