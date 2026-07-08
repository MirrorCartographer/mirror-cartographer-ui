const TAU = Math.PI * 2;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function markAge(mark) {
  return Math.min(1, (Date.now() - mark.time) / 6200);
}

function weatherSpin(kind, fallback = 0.45) {
  if (kind === 'wind') return 1.25;
  if (kind === 'murmur') return 1.05;
  if (kind === 'lightning') return 1.7;
  if (kind === 'rain') return -0.62;
  if (kind === 'clear') return 0.28;
  if (kind === 'dawn') return 0.72;
  return fallback;
}

function fieldVector(x, y, marks, time, rhythm) {
  let vx = Math.sin(y * 7.2 + time * 0.012) * 0.18;
  let vy = Math.cos(x * 6.8 - time * 0.01) * 0.18;

  marks.forEach((mark, index) => {
    const age = markAge(mark);
    const life = (1 - age) ** 1.7;
    if (life <= 0.01) return;
    const mx = clamp01(mark.x);
    const my = clamp01(mark.y);
    const dx = x - mx;
    const dy = y - my;
    const distanceSq = dx * dx + dy * dy + 0.002;
    const influence = Math.min(2.4, life / distanceSq) * 0.012;
    const spin = weatherSpin(mark.kind) * (1 + rhythm * 0.045);
    const direction = index % 2 === 0 ? 1 : -1;
    vx += (-dy * spin * direction + dx * 0.24) * influence;
    vy += (dx * spin * direction + dy * 0.24) * influence;
  });

  return { vx, vy };
}

function wakeColor(state, spec, alpha) {
  if (state === 'rain') return `rgba(145,216,255,${alpha})`;
  if (state === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (state === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (state === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (state === 'lightning') return `rgba(239,251,255,${alpha})`;
  if (spec?.tether) return `rgba(${spec.tether},${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

export function drawPressureWake(ctx, marks, env) {
  const { width, height, time, pulse, rhythm, state, spec, budget } = env;
  const active = marks.slice(-(budget.pressureWakeMarks || 10));
  if (!active.length) return;

  const pathCount = budget.pressureWakePaths || 18;
  const stepCount = budget.pressureWakeSteps || 7;
  const seedRadius = budget.mobile ? 0.18 : 0.24;
  const step = budget.mobile ? 0.026 : 0.021;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = state === 'murmur' ? '#c4b5fd' : state === 'rain' ? '#91d8ff' : '#ffe2bf';
  ctx.shadowBlur = budget.mobile ? 10 : 18;

  for (let i = 0; i < pathCount; i += 1) {
    const source = active[i % active.length];
    const age = markAge(source);
    const life = Math.max(0, 1 - age);
    if (life <= 0.02) continue;

    const phase = i * 2.399963 + time * 0.006;
    let x = clamp01(source.x + Math.cos(phase) * seedRadius * (0.2 + life * 0.8));
    let y = clamp01(source.y + Math.sin(phase * 1.13) * seedRadius * (0.2 + life * 0.8));
    const alpha = (0.035 + pulse * 0.065 + life * 0.08) * (state === 'clear' ? 0.55 : 1);

    ctx.beginPath();
    ctx.strokeStyle = wakeColor(state, spec, alpha);
    ctx.lineWidth = 0.8 + life * 1.6 + pulse * 0.7;
    ctx.moveTo(x * width, y * height);

    for (let p = 0; p < stepCount; p += 1) {
      const vector = fieldVector(x, y, active, time + p * 7, rhythm);
      const speed = Math.max(0.018, Math.min(0.07, Math.hypot(vector.vx, vector.vy)));
      x = clamp01(x + (vector.vx / speed) * step);
      y = clamp01(y + (vector.vy / speed) * step);
      const bend = Math.sin(phase + p * 0.9 + time * 0.014) * 4 * life;
      ctx.lineTo(x * width + bend, y * height - bend * 0.4);
    }

    ctx.stroke();
  }

  ctx.restore();
}
