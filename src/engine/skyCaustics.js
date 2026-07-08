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
    gate: 0.25 + Math.random() * 0.75,
  }));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function markFreshness(mark, now, duration) {
  return mark ? Math.max(0, 1 - (now - mark.time) / duration) : 0;
}

function causticPalette(state, spec) {
  if (state === 'rain') return ['145,216,255', '247,251,255'];
  if (state === 'lightning') return ['239,251,255', '125,211,252'];
  if (state === 'dawn') return ['255,226,191', '255,209,220'];
  if (state === 'aurora') return ['167,243,208', '196,181,253'];
  if (state === 'murmur') return ['196,181,253', '167,243,208'];
  return spec.warmth > 0.6 ? ['255,226,191', '247,251,255'] : ['247,251,255', '125,211,252'];
}

function drawCrepuscularApertures(ctx, marks, palette, options) {
  const { width: w, height: h, time: t, now = Date.now(), pulse, rhythm, state, spec, budget } = options;
  const latest = marks.at(-1);
  const fresh = markFreshness(latest, now, 5200);
  const idleTinyScreen = budget.ultraTiny && !latest && pulse < 0.76;
  const awake = !idleTinyScreen && (fresh > 0.02 || state === 'dawn' || state === 'clear' || state === 'cloud' || pulse > 0.72);
  if (!awake) return;

  const sourceX = latest ? latest.x * w : w * (0.5 + Math.sin(t * 0.003) * 0.18);
  const sourceY = latest ? latest.y * h : h * (state === 'dawn' ? 0.78 : 0.34 + Math.cos(t * 0.004) * 0.08);
  const vanishX = w * (0.5 + Math.sin(t * 0.002 + rhythm * 0.1) * (state === 'wind' ? 0.32 : 0.18));
  const vanishY = h * (state === 'dawn' ? 1.08 : state === 'clear' ? -0.08 : 0.92);
  const base = Math.atan2(sourceY - vanishY, sourceX - vanishX);
  const fan = state === 'murmur' ? 1.55 : state === 'lightning' ? 1.25 : 1.05;
  const rayCount = Math.max(6, Math.min(budget.causticRays || 18, budget.mobile ? 14 : 24));
  const color = state === 'lightning' ? '239,251,255' : palette[0];
  const warmth = state === 'dawn' || spec.warmth > 0.6 ? palette[1] : color;
  const opening = Math.sin(Math.min(1, fresh + pulse * 0.35) * Math.PI);
  const drift = Math.sin(t * 0.018) * 0.08 + rhythm * 0.012;
  const reach = Math.hypot(w, h) * (0.72 + pulse * 0.34 + opening * 0.24);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';

  for (let i = 0; i < rayCount; i += 1) {
    const q = rayCount <= 1 ? 0.5 : i / (rayCount - 1);
    const centered = q - 0.5;
    const flutter = Math.sin(t * 0.026 + i * 1.7 + rhythm * 0.22) * 0.045;
    const aperture = Math.pow(Math.abs(Math.sin(q * Math.PI)), 0.7);
    const angle = base + centered * fan + drift + flutter;
    const inner = 26 + aperture * 34 + fresh * 24;
    const outer = reach * (0.56 + aperture * 0.46);
    const x1 = sourceX + Math.cos(angle) * inner;
    const y1 = sourceY + Math.sin(angle) * inner;
    const x2 = sourceX + Math.cos(angle) * outer;
    const y2 = sourceY + Math.sin(angle) * outer;
    const cpx = (x1 + x2) * 0.5 + Math.sin(t * 0.011 + i) * 34 * budget.motionScale;
    const cpy = (y1 + y2) * 0.5 + Math.cos(t * 0.013 + i) * 22 * budget.motionScale;
    const alpha = clamp01((0.018 + pulse * 0.024 + opening * 0.12) * aperture * budget.densityScale);
    if (alpha < 0.006) continue;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, `rgba(${warmth},0)`);
    gradient.addColorStop(0.18, `rgba(${warmth},${alpha * 0.85})`);
    gradient.addColorStop(0.58, `rgba(${color},${alpha * 0.42})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = (budget.mobile ? 5 : 9) + aperture * (budget.mobile ? 8 : 15) + pulse * 6;
    ctx.shadowColor = `rgba(${warmth},1)`;
    ctx.shadowBlur = budget.mobile ? 4 : 18 + pulse * 18;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
  }

  if (!budget.mobile && opening > 0.08) {
    ctx.globalAlpha = 0.08 + opening * 0.12;
    ctx.fillStyle = `rgba(${warmth},1)`;
    ctx.shadowColor = `rgba(${warmth},1)`;
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.ellipse(sourceX, sourceY, 26 + opening * 38, 8 + opening * 14, base + Math.PI / 2, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawShearCurlComb(ctx, marks, palette, options) {
  const { width: w, height: h, time: t, now = Date.now(), pulse, rhythm, state, spec, budget } = options;
  const latest = marks.at(-1);
  const previous = latest?.prev;
  const fresh = markFreshness(latest, now, 4600);
  const wakeFresh = markFreshness(previous, now, 5200);
  const idleMotion = state === 'wind' || state === 'murmur' || state === 'aurora' || pulse > 0.78;
  if (budget.ultraTiny && !latest) return;
  if (fresh < 0.02 && !idleMotion) return;

  const startX = previous ? previous.x * w : w * (0.18 + Math.sin(t * 0.003) * 0.08);
  const startY = previous ? previous.y * h : h * (0.32 + Math.cos(t * 0.004) * 0.11);
  const endX = latest ? latest.x * w : w * (0.82 + Math.sin(t * 0.002 + 2) * 0.08);
  const endY = latest ? latest.y * h : h * (0.36 + Math.sin(t * 0.003) * 0.12);
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;
  const color = state === 'lightning' ? '239,251,255' : palette[(state === 'dawn' || spec.warmth > 0.7) ? 1 : 0];
  const curls = Math.max(3, Math.min(budget.mobile ? 5 : 9, Math.round((budget.causticCells || 10) * 0.52)));
  const segments = budget.mobile ? 18 : 26;
  const amplitude = Math.min(Math.min(w, h) * 0.15, 24 + rhythm * 7 + pulse * 52) * budget.motionScale;
  const gestureForce = clamp01((fresh + wakeFresh * 0.4 + pulse * 0.35) * (latest ? 1.05 : 0.62));
  const shear = (state === 'wind' ? 1.25 : state === 'murmur' ? 1.45 : state === 'rain' ? 0.82 : 1) * (0.75 + spec.motion * 0.45);
  const alphaBase = (0.03 + gestureForce * 0.22) * budget.densityScale;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < curls; i += 1) {
    const row = curls <= 1 ? 0.5 : i / (curls - 1);
    const offset = (row - 0.5) * Math.min(h * 0.22, 120 + rhythm * 8);
    const curlPhase = t * 0.028 + i * 0.72 + rhythm * 0.19;
    const perform = Math.sin(clamp01(fresh + pulse * 0.22) * Math.PI);
    const gradient = ctx.createLinearGradient(startX, startY + offset, endX, endY - offset);
    gradient.addColorStop(0, `rgba(${color},0)`);
    gradient.addColorStop(0.26, `rgba(${color},${alphaBase * (0.45 + row)})`);
    gradient.addColorStop(0.68, `rgba(${palette[(i + 1) % palette.length]},${alphaBase * 0.7})`);
    gradient.addColorStop(1, `rgba(${color},0)`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = (budget.mobile ? 1.2 : 1.8) + perform * (budget.mobile ? 1.5 : 2.6);
    ctx.shadowColor = `rgba(${color},1)`;
    ctx.shadowBlur = budget.mobile ? 2 : 12 + perform * 12;
    ctx.globalAlpha = clamp01(0.34 + gestureForce * 0.74 - row * 0.08);
    ctx.beginPath();

    for (let p = 0; p <= segments; p += 1) {
      const q = p / segments;
      const curlWindow = Math.pow(Math.sin(q * Math.PI), 0.72);
      const roll = Math.sin(q * TAU * (1.35 + shear * 0.24) + curlPhase) * curlWindow;
      const breaker = Math.cos(q * TAU * 2 + curlPhase * 0.7) * curlWindow * (0.26 + perform * 0.74);
      const x = startX + dx * q + nx * (offset + roll * amplitude * 0.22);
      const y = startY + dy * q + ny * (offset + roll * amplitude) - Math.abs(breaker) * amplitude * 0.42;
      if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }

    ctx.stroke();

    if (!budget.mobile && gestureForce > 0.22) {
      const beadCount = 3;
      ctx.fillStyle = `rgba(${color},${alphaBase * 1.2})`;
      for (let b = 0; b < beadCount; b += 1) {
        const q = (b + 1) / (beadCount + 1);
        const roll = Math.sin(q * TAU * (1.35 + shear * 0.24) + curlPhase) * Math.sin(q * Math.PI);
        ctx.beginPath();
        ctx.arc(startX + dx * q + nx * (offset + roll * amplitude * 0.22), startY + dy * q + ny * (offset + roll * amplitude), 1.8 + perform * 2.2, 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

export function drawSkyCaustics(ctx, cells, marks, options) {
  const { width: w, height: h, time: t, now = Date.now(), pulse, rhythm, state, spec, budget } = options;
  if (w <= 1 || h <= 1 || budget.densityScale <= 0.05) return;

  const latest = marks.at(-1);
  const fresh = markFreshness(latest, now, 4200);
  const active = fresh > 0.02 || state === 'rain' || state === 'clear' || state === 'dawn' || state === 'murmur' || pulse > 0.62;
  if (!active) return;

  const palette = causticPalette(state, spec);
  const touchX = latest ? latest.x : 0.5 + Math.sin(t * 0.004) * 0.14;
  const touchY = latest ? latest.y : 0.46 + Math.cos(t * 0.003) * 0.12;
  const rays = Math.max(6, budget.causticRays || 18);
  const drawCells = cells.slice(0, budget.causticCells || cells.length);
  const weatherFocus = state === 'clear' ? 1.2 : state === 'rain' ? 1.45 : state === 'murmur' ? 1.35 : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  drawCrepuscularApertures(ctx, marks, palette, options);
  drawShearCurlComb(ctx, marks, palette, options);

  drawCells.forEach((cell, i) => {
    const pull = fresh * (state === 'rain' ? 0.0011 : 0.00072);
    const orbit = Math.sin(t * 0.006 + cell.phase + rhythm * 0.12);
    const gateBreath = 0.8 + Math.sin(t * 0.017 + cell.gate * TAU) * 0.2;
    cell.x += cell.drift * (state === 'wind' || state === 'murmur' ? 2.2 : 1) + (touchX - cell.x) * pull;
    cell.y += Math.sin(t * 0.004 + cell.phase) * 0.00032 + (touchY - cell.y) * pull * 0.62;
    cell.phase += cell.spin * (0.4 + spec.motion);
    if (cell.x > 1.12) cell.x = -0.12;
    if (cell.x < -0.14) cell.x = 1.1;
    if (cell.y > 0.86) cell.y = 0.12;
    if (cell.y < 0.08) cell.y = 0.82;

    const x = cell.x * w;
    const y = cell.y * h;
    const size = cell.radius * Math.min(w, h) * (1 + pulse * 0.36 + fresh * 0.55) * gateBreath;
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
