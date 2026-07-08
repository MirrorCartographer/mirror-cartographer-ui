const TAU = Math.PI * 2;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function colorFor(kind, spec, alpha) {
  if (kind === 'rain') return `rgba(145,216,255,${alpha})`;
  if (kind === 'lightning') return `rgba(239,251,255,${alpha})`;
  if (kind === 'aurora') return `rgba(167,243,208,${alpha})`;
  if (kind === 'dawn') return `rgba(255,209,220,${alpha})`;
  if (kind === 'murmur') return `rgba(196,181,253,${alpha})`;
  if (kind === 'wind') return `rgba(255,240,199,${alpha})`;
  if (spec?.tether) return `rgba(${spec.tether},${alpha})`;
  return `rgba(255,226,191,${alpha})`;
}

function memoryPull(kind) {
  if (kind === 'rain') return 0.8;
  if (kind === 'lightning') return 1.6;
  if (kind === 'murmur') return 1.35;
  if (kind === 'wind') return 1.2;
  if (kind === 'clear') return 0.55;
  return 1;
}

export function createTrailMemory() {
  return {
    seen: new Set(),
    sparks: [],
  };
}

export function drawTrailMemory(ctx, memory, marks, env) {
  if (!memory || !Array.isArray(marks)) return;
  const { width, height, time, pulse, rhythm, state, spec, budget } = env;
  const maxSparks = budget.trailMemorySparks || 34;
  const activeMarks = marks.slice(-(budget.trailMemoryMarks || 12));

  activeMarks.forEach((mark, index) => {
    if (!mark || memory.seen.has(mark.time)) return;
    memory.seen.add(mark.time);
    const count = budget.mobile ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      const phase = mark.spin + i * TAU / count + index * 0.41;
      memory.sparks.push({
        x: clamp01(mark.x),
        y: clamp01(mark.y),
        vx: Math.cos(phase) * 0.0018,
        vy: Math.sin(phase) * 0.0018,
        age: 0,
        phase,
        kind: mark.kind,
      });
    }
  });

  if (!memory.sparks.length) return;
  if (memory.sparks.length > maxSparks) memory.sparks.splice(0, memory.sparks.length - maxSparks);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = state === 'murmur' ? '#c4b5fd' : state === 'rain' ? '#91d8ff' : '#ffe2bf';
  ctx.shadowBlur = budget.mobile ? 8 : 16;

  const recent = activeMarks.slice(-5);
  memory.sparks = memory.sparks.filter((spark, index) => {
    spark.age += budget.mobile ? 0.012 : 0.009;
    if (spark.age >= 1) return false;

    let ax = Math.sin(time * 0.012 + spark.phase) * 0.00024;
    let ay = Math.cos(time * 0.01 + spark.phase * 1.7) * 0.00024;

    recent.forEach((mark, markIndex) => {
      const dx = clamp01(mark.x) - spark.x;
      const dy = clamp01(mark.y) - spark.y;
      const d2 = dx * dx + dy * dy + 0.003;
      const sign = markIndex % 2 === 0 ? 1 : -1;
      const pull = memoryPull(mark.kind) * (1 - spark.age) * 0.00042 / d2;
      ax += (dx * 0.62 - dy * 0.24 * sign) * pull;
      ay += (dy * 0.62 + dx * 0.24 * sign) * pull;
    });

    spark.vx = (spark.vx + ax) * 0.982;
    spark.vy = (spark.vy + ay) * 0.982;
    spark.x = clamp01(spark.x + spark.vx * (1 + rhythm * 0.03));
    spark.y = clamp01(spark.y + spark.vy * (1 + rhythm * 0.03));

    const life = (1 - spark.age) ** 1.7;
    const wobble = Math.sin(time * 0.04 + spark.phase + index) * (2 + pulse * 5);
    const px = spark.x * width;
    const py = spark.y * height;
    const tail = 10 + rhythm * 1.2 + pulse * 14;
    const alpha = (0.04 + pulse * 0.07) * life;

    ctx.strokeStyle = colorFor(spark.kind || state, spec, alpha);
    ctx.lineWidth = 0.6 + life * 1.7;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - spark.vx * width * tail + wobble, py - spark.vy * height * tail - wobble * 0.35, px - spark.vx * width * tail * 2, py - spark.vy * height * tail * 2);
    ctx.stroke();

    ctx.fillStyle = colorFor(spark.kind || state, spec, alpha * 1.7);
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + life * 2.2, 0, TAU);
    ctx.fill();
    return true;
  });

  ctx.restore();
}
