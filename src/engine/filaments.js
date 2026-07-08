const TAU = Math.PI * 2;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function rgbaTriplet(triplet, alpha) {
  return `rgba(${triplet},${clamp(alpha, 0, 1)})`;
}

function seededPhase(mark, index) {
  return (mark.x * 31.7 + mark.y * 19.3 + index * 2.41 + (mark.time % 997) * 0.003) % TAU;
}

export function filamentBudget(width, budget) {
  const mobile = width < 700;
  return {
    ropes: mobile ? Math.min(3, budget.renderedFilaments) : budget.renderedFilaments,
    segments: mobile ? budget.mobileFilamentSegments : budget.filamentSegments,
  };
}

export function drawSkyFilaments(ctx, marks, options) {
  const {
    width,
    height,
    time,
    pulse,
    rhythm,
    state,
    skyState,
    budget,
  } = options;

  const active = marks.slice(-budget.ropes);
  if (!active.length) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  active.forEach((mark, index) => {
    const age = clamp((Date.now() - mark.time) / 11200, 0, 1);
    const fade = (1 - age) * (0.12 + pulse * 0.36);
    if (fade <= 0.01) return;

    const spec = skyState(mark.kind || state);
    const color = spec.tether;
    const startX = mark.x * width;
    const startY = mark.y * height;
    const endX = width * (0.5 + Math.sin(time * 0.006 + index) * 0.035);
    const endY = height * (state === 'murmur' ? 0.48 : 0.62 + Math.cos(time * 0.005 + index) * 0.025);
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const phase = seededPhase(mark, index);
    const weatherSlack = mark.kind === 'rain' ? -0.12 : mark.kind === 'wind' ? 0.35 : mark.kind === 'murmur' ? 0.42 : 0.18;
    const gestureForce = 1 + rhythm * 0.08 + pulse * 0.9;

    ctx.lineWidth = 0.75 + index * 0.18 + pulse * 1.2;
    ctx.shadowColor = rgbaTriplet(color, 0.82);
    ctx.shadowBlur = 10 + pulse * 24;
    ctx.strokeStyle = rgbaTriplet(color, fade);
    ctx.beginPath();

    for (let segment = 0; segment <= budget.segments; segment += 1) {
      const q = segment / budget.segments;
      const breathe = Math.sin(q * Math.PI);
      const wave = Math.sin(time * 0.034 + phase + q * 9.2) * breathe * (8 + rhythm * 2.8);
      const sag = Math.sin(q * Math.PI) * distance * weatherSlack * 0.05 * gestureForce;
      const tremble = Math.sin(time * 0.11 + phase * 1.7 + segment) * breathe * (mark.kind === 'lightning' ? 18 : 4 + pulse * 8);
      const x = startX + dx * q + normalX * (wave + tremble);
      const y = startY + dy * q + normalY * (wave + tremble) + sag;
      if (segment === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (state === 'murmur' || mark.kind === 'murmur') {
      ctx.globalAlpha = fade * 0.55;
      ctx.beginPath();
      ctx.arc(startX, startY, 8 + Math.sin(time * 0.08 + phase) * 3 + pulse * 8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });

  ctx.restore();
}
