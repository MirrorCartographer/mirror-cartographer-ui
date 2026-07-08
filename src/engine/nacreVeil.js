const TAU = Math.PI * 2;

export function createNacreVeil(count) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: Math.random(),
    y: 0.08 + Math.random() * 0.48,
    width: 0.18 + Math.random() * 0.28,
    height: 0.035 + Math.random() * 0.09,
    phase: Math.random() * TAU,
    drift: 0.00035 + Math.random() * 0.00075,
    tilt: -0.18 + Math.random() * 0.36,
    bright: 0.45 + Math.random() * 0.55,
  }));
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function veilPalette(state, warmth) {
  if (state === 'rain') return ['145,216,255', '196,181,253', '247,251,255'];
  if (state === 'dawn') return ['255,209,220', '255,226,191', '167,243,208'];
  if (state === 'aurora') return ['167,243,208', '196,181,253', '125,211,252'];
  if (state === 'murmur') return ['196,181,253', '167,243,208', '240,171,252'];
  if (state === 'lightning') return ['239,251,255', '125,211,252', '196,181,253'];
  return warmth > 0.62 ? ['255,226,191', '255,209,220', '125,211,252'] : ['247,251,255', '125,211,252', '196,181,253'];
}

export function drawNacreVeil(ctx, veil, marks, options) {
  const { width: w, height: h, time: t, pulse, rhythm, state, spec, budget } = options;
  const latest = marks.at(-1);
  const fresh = latest ? Math.max(0, 1 - (Date.now() - latest.time) / 5200) : 0;
  const palette = veilPalette(state, spec.warmth);
  const bands = veil.slice(0, budget.nacreBands);
  const mistLoops = budget.nacreMist;
  const touchX = latest ? latest.x : 0.5 + Math.sin(t * 0.003) * 0.12;
  const touchY = latest ? latest.y : 0.34 + Math.cos(t * 0.002) * 0.08;
  const active = state === 'cloud' || state === 'dawn' || state === 'aurora' || state === 'murmur' || pulse > 0.58 || fresh > 0.05;

  if (!active) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  bands.forEach((band, i) => {
    const weatherLift = state === 'dawn' ? -0.00018 : state === 'rain' ? 0.00012 : 0;
    const pullX = (touchX - band.x) * fresh * 0.00058;
    const pullY = (touchY - band.y) * fresh * 0.00032;
    band.x += band.drift * (state === 'wind' || state === 'murmur' ? 1.9 : 1) + pullX;
    band.y += Math.sin(t * 0.006 + band.phase) * 0.00028 + weatherLift + pullY;
    if (band.x > 1.16) band.x = -0.16;
    if (band.y < 0.04) band.y = 0.52;
    if (band.y > 0.58) band.y = 0.08;

    const x = band.x * w;
    const y = band.y * h;
    const bw = band.width * w * (1 + pulse * 0.08 + fresh * 0.12);
    const bh = band.height * h * (1 + Math.sin(t * 0.012 + band.phase) * 0.1);
    const shimmer = 0.5 + Math.sin(t * 0.021 + band.phase + rhythm * 0.24) * 0.5;
    const localAlpha = (0.035 + pulse * 0.035 + fresh * 0.12 + shimmer * 0.04) * band.bright * budget.densityScale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(band.tilt + Math.sin(t * 0.004 + i) * 0.05);
    ctx.shadowBlur = budget.mobile ? 8 : 18 + pulse * 14;

    for (let m = 0; m < mistLoops; m += 1) {
      const q = mistLoops <= 1 ? 0.5 : m / (mistLoops - 1);
      const color = palette[(m + i) % palette.length];
      const offset = (q - 0.5) * bh * 2.4;
      const wobble = Math.sin(t * 0.026 + q * 5.8 + band.phase) * bh * 0.36;
      const alpha = clamp01(localAlpha * (1 - Math.abs(q - 0.5) * 0.72));
      const gradient = ctx.createLinearGradient(-bw * 0.5, offset, bw * 0.5, offset + wobble);
      gradient.addColorStop(0, `rgba(${color},0)`);
      gradient.addColorStop(0.22, `rgba(${color},${alpha * 0.48})`);
      gradient.addColorStop(0.48, `rgba(${palette[(m + 1) % palette.length]},${alpha})`);
      gradient.addColorStop(0.78, `rgba(${color},${alpha * 0.42})`);
      gradient.addColorStop(1, `rgba(${color},0)`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(0.7, bh * (0.035 + q * 0.025));
      ctx.shadowColor = `rgba(${color},1)`;
      ctx.beginPath();
      for (let p = 0; p <= 18; p += 1) {
        const u = p / 18;
        const px = -bw * 0.5 + u * bw;
        const py = offset + Math.sin(u * TAU * 1.18 + t * 0.018 + band.phase + q * 2.5) * bh * (0.16 + fresh * 0.22) + wobble * Math.sin(u * Math.PI);
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (!budget.mobile && fresh > 0.08) {
      ctx.globalAlpha = fresh * 0.12;
      ctx.strokeStyle = `rgba(${palette[0]},1)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, bw * (0.24 + fresh * 0.24), bh * (0.9 + pulse * 0.28), 0, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  });

  ctx.restore();
}
