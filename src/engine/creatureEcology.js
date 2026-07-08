const TAU = Math.PI * 2;

export function seedCreatures(count) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: Math.random(),
    y: 0.18 + Math.random() * 0.58,
    vx: (Math.random() - 0.5) * 0.002,
    vy: (Math.random() - 0.5) * 0.002,
    phase: Math.random() * TAU,
    scale: 0.7 + Math.random() * 1.4,
    nerve: Math.random(),
    memory: 0,
  }));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function creatureColor(state, spec) {
  if (state === 'rain') return '#9cdcff';
  if (state === 'aurora') return '#a7f3d0';
  if (state === 'murmur') return '#c4b5fd';
  if (state === 'dawn') return '#ffd1dc';
  if (spec.mark === '#91d8ff') return '#fff8ef';
  return '#fff0c7';
}

function weatherForce(state) {
  if (state === 'wind') return 0.00034;
  if (state === 'rain') return -0.00012;
  if (state === 'lightning') return 0.00062;
  if (state === 'murmur') return 0.00048;
  return 0.00018;
}

export function drawCreatureEcology(ctx, creatures, marks, options) {
  const { width: w, height: h, time: t, pulse, rhythm, state, spec, budget } = options;
  const active = creatures.slice(0, budget.creatures);
  const latest = marks.at(-1);
  const pull = weatherForce(state);
  const touched = latest ? Math.max(0, 1 - (Date.now() - latest.time) / 2400) : 0;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  active.forEach((c, i) => {
    let ax = (0.5 - c.x) * 0.00004;
    let ay = (0.42 + spec.warmth * 0.18 - c.y) * 0.000035;

    active.forEach((o, j) => {
      if (i === j) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.0019) {
        ax -= dx * 0.0009;
        ay -= dy * 0.0009;
      } else if (d2 < 0.028) {
        ax += dx * 0.000018;
        ay += dy * 0.000018;
      }
    });

    if (latest) {
      const dx = latest.x - c.x;
      const dy = latest.y - c.y;
      const d = Math.max(0.02, Math.hypot(dx, dy));
      const mood = latest.kind === 'lightning' || latest.kind === 'wind' ? -1 : 1;
      const curious = state === 'murmur' ? Math.sin(t * 0.025 + c.phase) : 0;
      ax += (dx / d) * touched * mood * (0.00048 + curious * 0.0001);
      ay += (dy / d) * touched * mood * (0.00048 - curious * 0.00008);
      c.memory = Math.max(c.memory, touched);
    }

    c.memory *= 0.982;
    ax += Math.sin(t * 0.011 + c.phase) * pull;
    ay += Math.cos(t * 0.009 + c.phase * 1.7) * pull * 0.62;
    c.vx = clamp((c.vx + ax) * 0.982, -0.006, 0.006);
    c.vy = clamp((c.vy + ay) * 0.982, -0.005, 0.005);
    c.x += c.vx;
    c.y += c.vy;

    if (c.x < -0.05) c.x = 1.05;
    if (c.x > 1.05) c.x = -0.05;
    c.y = clamp(c.y, 0.08, 0.86);

    const x = c.x * w;
    const y = c.y * h;
    const speed = Math.hypot(c.vx, c.vy);
    const angle = Math.atan2(c.vy, c.vx || 0.0001);
    const performedBeat = Math.sin(t * (0.18 + speed * 80) + c.phase + c.memory * 2.6);
    const wing = performedBeat * (6 + rhythm * 0.4 + c.memory * 8);
    const blink = Math.max(0, Math.sin(t * 0.045 + c.phase * 3 + c.nerve * 9));
    const color = creatureColor(state, spec);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.16 + pulse * 0.25 + Math.min(0.24, speed * 24) + c.memory * 0.12;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 24 + c.memory * 18;
    ctx.lineWidth = 1.1;

    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2 * c.scale, 5.6 * c.scale, 0, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.quadraticCurveTo(-10 * c.scale, -wing, -18 * c.scale, -2 * c.scale);
    ctx.moveTo(1, 0);
    ctx.quadraticCurveTo(10 * c.scale, wing, 18 * c.scale, 2 * c.scale);
    ctx.stroke();

    if (state === 'murmur' || c.memory > 0.24) {
      ctx.globalAlpha *= state === 'murmur' && i % 3 === 0 ? 0.48 : 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * c.scale + blink * 7 + c.memory * 10, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  });

  ctx.restore();
}
