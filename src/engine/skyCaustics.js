const TAU = Math.PI * 2;

export function createSkyCaustics(count) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: Math.random(),
    y: 0.12 + Math.random() * 0.68,
    phase: Math.random() * TAU,
    spin: (Math.random() - 0.5) * 0.018,
    radius: 0.045 + Math.random() * 0.095,
    squeeze: 0.42 + Math.random() * 0.72,
    drift: 0.00018 + Math.random() * 0.00062,
    brightness: 0.45 + Math.random() * 0.55,
  }));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function causticPalette(state, spec) {
  if (state === 'rain') return ['145,216,255', '247,251,255'];
  if (state === 'lightning') return ['239,251,255', '125,211,252'];
  if (state === 'dawn') return ['255,226,191', '255,209,220'];
  if (state === 'aurora') return ['167,243,208', '196,181,253'];
  if (state === 'murmur') return ['196,181,253', '167,243,208'];
  return spec.warmth > 0.6 ? ['255,226,191', '247,251,255'] : ['247,251,255', '125,211,252'];
}

export function drawSkyCaustics(ctx, cells, marks, options) {
  const { width: w, height: h, time: t, pulse, rhythm, state, spec, budget } = options;
  const latest = marks.at(-1);
  const fresh = latest ? Math.max(0, 1 - (Date.now() - latest.time) / 4200) : 0;
  const active = fresh > 0.02 || state === 'rain' || state === 'clear' || state === 'dawn' || state === 'murmur' || pulse > 0.62;
  if (!active) return;

  const palette = causticPalette(state, spec);
  const touchX = latest ? latest.x : 0.5 + Math.sin(t * 0.004) * 0.14;
  const touchY = latest ? latest.y : 0.46 + Math.cos(t * 0.003) * 0.12;
  const rays = Math.max(8, budget.causticRays || 18);
  const drawCells = cells.slice(0, budget.causticCells || cells.length);
  const weatherFocus = state === 'clear' ? 1.2 : state === 'rain' ? 1.45 : state === 'murmur' ? 1.35 : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  drawCells.forEach((cell, i) => {
    const pull = fresh * (state === 'rain' ? 0.0011 : 0.00072);
    const orbit = Math.sin(t * 0.006 + cell.phase + rhythm * 0.12);
    cell.x += cell.drift * (state === 'wind' || state === 'murmur' ? 2.2 : 1) + (touchX - cell.x) * pull;
    cell.y += Math.sin(t * 0.004 + cell.phase) * 0.00032 + (touchY - cell.y) * pull * 0.62;
    cell.phase += cell.spin * (0.4 + spec.motion);
    if (cell.x > 1.12) cell.x = -0.12;
    if (cell.x < -0.14) cell.x = 1.1;
    if (cell.y > 0.86) cell.y = 0.12;
    if (cell.y < 0.08) cell.y = 0.82;

    const x = cell.x * w;
    const y = cell.y * h;
    const size = cell.radius * Math.min(w, h) * (1 + pulse * 0.36 + fresh * 0.55);
    const color = palette[i % palette.length];
    const alpha = clamp01((0.035 + pulse * 0.035 + fresh * 0.17) * cell.brightness * budget.densityScale);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cell.phase + orbit * 0.18);
    ctx.shadowColor = `rgba(${color},1)`;
    ctx.shadowBlur = budget.mobile ? 5 : 12 + pulse * 18;
    ctx.lineWidth = budget.mobile ? 0.7 : 0.85 + pulse * 0.8;

    for (let r = 0; r < rays; r += 1) {
      const q = r / rays;
      const a = q * TAU;
      const cusp = Math.pow(Math.abs(Math.sin(a * 1.5 + cell.phase + t * 0.018)), 1.7);
      const inner = size * (0.16 + cusp * 0.22);
      const outer = size * (0.58 + cusp * (0.92 + fresh * 0.4) * weatherFocus);
      const bend = Math.sin(t * 0.015 + q * 8 + cell.phase) * size * 0.09;
      const squeeze = cell.squeeze + Math.sin(t * 0.008 + i) * 0.12;
      const x1 = Math.cos(a) * inner;
      const y1 = Math.sin(a) * inner * squeeze;
      const x2 = Math.cos(a + bend / Math.max(1, outer)) * outer;
      const y2 = Math.sin(a) * outer * squeeze;
      const fade = alpha * (0.2 + cusp * 0.8) * (r % 3 === 0 ? 1 : 0.45);
      if (fade < 0.01) continue;
      ctx.strokeStyle = `rgba(${color},${fade})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.52 + bend, (y1 + y2) * 0.48 - bend * 0.4, x2, y2);
      ctx.stroke();
    }

    if (!budget.mobile && fresh > 0.08) {
      ctx.globalAlpha = fresh * 0.11;
      ctx.strokeStyle = `rgba(${palette[(i + 1) % palette.length]},1)`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.72, size * 0.28 * cell.squeeze, orbit * 0.22, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  });

  ctx.restore();
}
