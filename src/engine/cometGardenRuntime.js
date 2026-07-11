const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function installCometGardenRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const garden = document.createElement('div');
  garden.className = 'comet-garden';
  garden.setAttribute('aria-hidden', 'true');
  document.body.appendChild(garden);

  const particles = [];
  const MAX = window.innerWidth < 700 ? 18 : 30;
  let raf = 0;
  let last = 0;

  const spawn = (x, y, force = 0.5) => {
    if (particles.length >= MAX) particles.shift()?.el.remove();
    const el = document.createElement('i');
    el.className = 'comet-seed';
    garden.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.25 + force * 1.4 + Math.random() * 0.5;
    particles.push({
      el,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.35,
      life: 1,
      size: 3 + force * 8 + Math.random() * 5,
      hue: 170 + Math.random() * 130,
    });
  };

  const onPointer = (event) => {
    if (!event.isPrimary) return;
    const force = clamp(Math.hypot(event.movementX || 0, event.movementY || 0) / 24, 0.15, 1);
    spawn(event.clientX, event.clientY, force);
    if (force > 0.7) spawn(event.clientX, event.clientY, force * 0.7);
  };

  const loop = (time) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || time - last < 32) return;
    last = time;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= 0.018;
      p.vx *= 0.992;
      p.vy -= 0.006;
      p.x += p.vx;
      p.y += p.vy;
      if (p.life <= 0) {
        p.el.remove();
        particles.splice(i, 1);
        continue;
      }
      p.el.style.transform = `translate3d(${p.x}px,${p.y}px,0) scale(${p.life})`;
      p.el.style.opacity = String(p.life * 0.72);
      p.el.style.width = `${p.size}px`;
      p.el.style.height = `${p.size}px`;
      p.el.style.filter = `hue-rotate(${p.hue}deg)`;
    }
  };

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', onPointer);
    garden.remove();
  };
}
