const TAU = Math.PI * 2;

const FIELD_WIDTH = 26;
const FIELD_HEIGHT = 18;

const WEATHER_GAIN = Object.freeze({
  cloud: 0.38,
  rain: 0.55,
  lightning: 0.92,
  clear: 0.28,
  aurora: 0.68,
  dawn: 0.46,
  wind: 0.74,
  murmur: 0.88,
});

export function createTuringVeil() {
  const cells = [];
  for (let y = 0; y < FIELD_HEIGHT; y += 1) {
    for (let x = 0; x < FIELD_WIDTH; x += 1) {
      const phase = Math.sin(x * 1.7) + Math.cos(y * 1.3);
      cells.push({
        x: (x + 0.5) / FIELD_WIDTH,
        y: (y + 0.5) / FIELD_HEIGHT,
        a: 0.48 + phase * 0.05,
        b: 0.18 + Math.sin((x - y) * 0.9) * 0.05,
        seed: Math.random() * TAU,
      });
    }
  }
  return { width: FIELD_WIDTH, height: FIELD_HEIGHT, cells };
}

export function drawTuringVeil(ctx, field, marks, scene) {
  const { width, height, time, pulse, rhythm, state, spec, budget } = scene;
  if (!field?.cells?.length || width <= 0 || height <= 0) return;

  const gain = WEATHER_GAIN[state] ?? 0.42;
  const stride = budget.mobile ? 2 : 1;
  const recent = marks.slice(-5);
  const step = 1 + Math.min(2, Math.floor(rhythm / 5));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < field.cells.length; i += stride) {
    const cell = field.cells[i];
    let attract = 0;
    for (let m = 0; m < recent.length; m += 1) {
      const mark = recent[m];
      const dx = cell.x - mark.x;
      const dy = cell.y - mark.y;
      attract += Math.max(0, 1 - Math.hypot(dx, dy) * 5.4) * (1 - m * 0.11);
    }

    const reaction = Math.sin(time * 0.013 * step + cell.seed + cell.a * 8 + attract * 2.6);
    const diffusion = Math.cos(time * 0.009 + cell.seed * 0.7 + cell.b * 12 - attract * 1.8);
    cell.a = clamp01(cell.a + (diffusion * 0.006 + attract * 0.018 - cell.b * 0.004) * gain);
    cell.b = clamp01(cell.b + (reaction * 0.005 + cell.a * cell.b * 0.002 + attract * 0.012 - 0.003) * gain);

    const v = clamp01(cell.b * 1.7 + reaction * 0.16 + pulse * 0.18);
    if (v < 0.22) continue;

    const px = cell.x * width + Math.sin(time * 0.006 + cell.seed) * width * 0.014 * spec.motion;
    const py = cell.y * height + Math.cos(time * 0.005 + cell.seed) * height * 0.016 * spec.motion;
    const radius = (budget.mobile ? 5 : 7) + v * (budget.mobile ? 18 : 28) + rhythm * 0.6;
    const color = state === 'dawn' ? '255,154,118' : state === 'rain' ? '145,216,255' : state === 'murmur' ? '196,181,253' : state === 'aurora' ? '167,243,208' : '255,226,191';

    ctx.globalAlpha = Math.min(0.36, 0.035 + v * 0.22 + attract * 0.2);
    ctx.strokeStyle = `rgba(${color},${0.18 + v * 0.34})`;
    ctx.lineWidth = 0.6 + v * 1.7;
    ctx.shadowColor = `rgba(${color},1)`;
    ctx.shadowBlur = 12 + v * 22;
    ctx.beginPath();
    ctx.arc(px, py, radius, reaction, reaction + Math.PI * (0.68 + diffusion * 0.26));
    ctx.stroke();
  }

  ctx.restore();
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
