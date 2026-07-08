const TAU = Math.PI * 2;

export function createMurmuration(count = 18, random = Math.random) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    x: random(),
    y: random() * 0.72,
    vx: (random() - 0.5) * 0.004,
    vy: (random() - 0.5) * 0.004,
    phase: random() * TAU,
  }));
}

export function stepMurmuration(agents, attractor, spec, bounds = { width: 1, height: 1 }) {
  const motion = Math.max(0.2, spec?.motion || 1);
  const target = attractor || { x: 0.5, y: 0.46 };
  return agents.map((agent) => {
    let separateX = 0;
    let separateY = 0;
    let alignX = 0;
    let alignY = 0;
    let cohereX = 0;
    let cohereY = 0;
    let nearby = 0;

    agents.forEach((other) => {
      if (other === agent) return;
      const dx = other.x - agent.x;
      const dy = other.y - agent.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.00001 && d2 < 0.028) {
        const push = 1 / Math.max(0.004, d2);
        separateX -= dx * push;
        separateY -= dy * push;
        alignX += other.vx;
        alignY += other.vy;
        cohereX += other.x;
        cohereY += other.y;
        nearby += 1;
      }
    });

    if (nearby) {
      alignX /= nearby;
      alignY /= nearby;
      cohereX = cohereX / nearby - agent.x;
      cohereY = cohereY / nearby - agent.y;
    }

    const lureX = target.x - agent.x;
    const lureY = target.y - agent.y;
    const nextVx = clamp(agent.vx * 0.92 + separateX * 0.00005 + alignX * 0.16 + cohereX * 0.002 + lureX * 0.0008, -0.012 * motion, 0.012 * motion);
    const nextVy = clamp(agent.vy * 0.92 + separateY * 0.00005 + alignY * 0.16 + cohereY * 0.002 + lureY * 0.0008, -0.010 * motion, 0.010 * motion);

    return {
      ...agent,
      vx: nextVx,
      vy: nextVy,
      x: wrap(agent.x + nextVx, bounds.width),
      y: clamp(agent.y + nextVy, 0.03, Math.max(0.12, bounds.height * 0.8)),
      phase: agent.phase + 0.04 * motion,
    };
  });
}

export function drawMurmuration(ctx, agents, width, height, spec, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = spec?.mark || '#c4b5fd';
  ctx.fillStyle = spec?.mark || '#c4b5fd';
  ctx.shadowColor = spec?.mark || '#c4b5fd';
  ctx.shadowBlur = 18;
  agents.forEach((agent, index) => {
    const x = agent.x * width;
    const y = agent.y * height;
    const angle = Math.atan2(agent.vy, agent.vx || 0.0001);
    const wing = 5 + Math.sin(agent.phase + index) * 2;
    ctx.globalAlpha = alpha * (0.28 + (index % 5) * 0.04);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * 9, y + Math.sin(angle) * 9);
    ctx.lineTo(x + Math.cos(angle + 2.55) * wing, y + Math.sin(angle + 2.55) * wing);
    ctx.lineTo(x + Math.cos(angle - 2.55) * wing, y + Math.sin(angle - 2.55) * wing);
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
}

function wrap(value, max) {
  if (value < -0.04) return max + 0.04;
  if (value > max + 0.04) return -0.04;
  return value;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
