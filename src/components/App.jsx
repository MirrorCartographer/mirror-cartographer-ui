import React, { useEffect, useMemo, useState } from 'react';

const STATES = [
  { id: 'hush', mark: '◌', name: 'hush', hue: 38, pulse: 9, depth: 0.18, curve: '42% 58% 52% 48%' },
  { id: 'pull', mark: '⌁', name: 'pull', hue: 205, pulse: 5, depth: 0.36, curve: '64% 36% 45% 55%' },
  { id: 'ache', mark: '●', name: 'ache', hue: 348, pulse: 7, depth: 0.52, curve: '38% 62% 68% 32%' },
  { id: 'spark', mark: '✶', name: 'spark', hue: 52, pulse: 3, depth: 0.72, curve: '50% 50% 28% 72%' },
  { id: 'float', mark: '◇', name: 'float', hue: 167, pulse: 12, depth: 0.28, curve: '72% 28% 62% 38%' },
  { id: 'return', mark: '↺', name: 'return', hue: 280, pulse: 10, depth: 0.44, curve: '47% 53% 39% 61%' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nearestState(x, y) {
  const centerX = x - 0.5;
  const centerY = y - 0.5;
  const angle = (Math.atan2(centerY, centerX) + Math.PI * 2) % (Math.PI * 2);
  return STATES[Math.floor((angle / (Math.PI * 2)) * STATES.length) % STATES.length];
}

function useMotion() {
  const [motion, setMotion] = useState({ x: 0.5, y: 0.5, speed: 0, lastX: 0.5, lastY: 0.5 });
  useEffect(() => {
    let last = { x: 0.5, y: 0.5, t: performance.now() };
    const move = (event) => {
      const touch = event.touches?.[0];
      const clientX = touch ? touch.clientX : event.clientX;
      const clientY = touch ? touch.clientY : event.clientY;
      const x = clamp(clientX / window.innerWidth, 0, 1);
      const y = clamp(clientY / window.innerHeight, 0, 1);
      const now = performance.now();
      const distance = Math.hypot(x - last.x, y - last.y);
      const speed = clamp(distance / Math.max(16, now - last.t) * 900, 0, 1);
      setMotion({ x, y, speed, lastX: last.x, lastY: last.y });
      last = { x, y, t: now };
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchmove', move);
    };
  }, []);
  return motion;
}

function BreathingLabyrinth({ state, motion, setState }) {
  const rings = Array.from({ length: 9 });
  const symbols = STATES.map((item, index) => {
    const angle = (index / STATES.length) * Math.PI * 2 - Math.PI / 2;
    const left = 50 + Math.cos(angle) * 39;
    const top = 50 + Math.sin(angle) * 39;
    return { ...item, left, top };
  });
  return (
    <section className="field" aria-label="somatic labyrinth">
      <div className="aperture" />
      <div className="human" />
      <div className="ai" />
      <div className="thread" />
      <div className="labyrinth">
        {rings.map((_, index) => <i key={index} className={`ring r${index}`} />)}
        <div className="center-mark"><span>{state.mark}</span></div>
        {symbols.map((item) => (
          <button key={item.id} className={`sense ${state.id === item.id ? 'active' : ''}`} style={{ left: `${item.left}%`, top: `${item.top}%` }} onClick={() => setState(item)} aria-label={item.name}>
            {item.mark}
          </button>
        ))}
      </div>
      <div className="trace" style={{ left: `${motion.x * 100}%`, top: `${motion.y * 100}%` }} />
    </section>
  );
}

function App() {
  const motion = useMotion();
  const [state, setState] = useState(STATES[0]);
  const autoState = useMemo(() => nearestState(motion.x, motion.y), [motion.x, motion.y]);

  useEffect(() => {
    if (motion.speed > 0.05) setState(autoState);
  }, [autoState, motion.speed]);

  const vars = {
    '--mx': motion.x,
    '--my': motion.y,
    '--speed': motion.speed,
    '--hue': state.hue,
    '--pulse': `${state.pulse}s`,
    '--depth': state.depth,
    '--curve': state.curve,
  };

  return (
    <main className="somatic-shell" style={vars}>
      <style>{styles}</style>
      <div className="grain" />
      <header className="quiet-title" aria-label="Mirror Cartographer">
        <b>Mirror Cartographer</b>
        <span>{state.mark}</span>
      </header>
      <BreathingLabyrinth state={state} motion={motion} setState={setState} />
      <nav className="feeling-keys" aria-label="feeling keys">
        {STATES.map((item) => <button key={item.id} className={state.id === item.id ? 'active' : ''} onClick={() => setState(item)}>{item.mark}</button>)}
      </nav>
      <footer className="barely">move slowly</footer>
    </main>
  );
}

const styles = `
:root{color-scheme:dark}*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0}body{background:#030201;overflow:hidden;font-family:Georgia,'Times New Roman',serif}.somatic-shell{--x:calc(var(--mx)*100%);--y:calc(var(--my)*100%);min-height:100vh;position:relative;overflow:hidden;color:hsl(var(--hue) 70% 88%);background:radial-gradient(circle at var(--x) var(--y),hsl(var(--hue) 72% 56% / calc(.18 + var(--speed)*.24)),transparent calc(18% + var(--speed)*15%)),radial-gradient(circle at calc((1 - var(--mx))*100%) calc((1 - var(--my))*100%),hsl(calc(var(--hue) + 80) 60% 48% / .18),transparent 31%),linear-gradient(120deg,#050302,#120907 48%,#020202);filter:saturate(calc(.82 + var(--speed)*.8))}.grain{position:fixed;inset:0;pointer-events:none;opacity:.33;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),radial-gradient(circle at 50% 50%,transparent,rgba(0,0,0,.72));background-size:42px 42px,42px 42px,100% 100%;mix-blend-mode:screen}.quiet-title{position:fixed;z-index:5;top:24px;left:28px;right:28px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}.quiet-title b{font-size:clamp(1.3rem,3vw,2.8rem);font-weight:400;letter-spacing:-.06em;text-shadow:0 0 24px hsl(var(--hue) 90% 70% / .2)}.quiet-title span{font-size:clamp(1.4rem,4vw,4rem);text-shadow:0 0 34px currentColor}.field{position:absolute;inset:0;display:grid;place-items:center;perspective:900px}.aperture{position:absolute;width:74vmin;height:74vmin;border-radius:var(--curve);border:1px solid hsl(var(--hue) 70% 72% / .22);box-shadow:0 0 0 12vmin hsl(var(--hue) 70% 55% / .025),0 0 0 23vmin hsl(calc(var(--hue) + 40) 62% 55% / .018),inset 0 0 12vmin rgba(0,0,0,.42);animation:breathe var(--pulse) ease-in-out infinite;transform:rotate(calc((var(--mx) - .5)*34deg)) scale(calc(.88 + var(--depth)*.18 + var(--speed)*.1))}.labyrinth{width:min(78vmin,760px);height:min(78vmin,760px);position:relative;transform:rotateX(calc((.5 - var(--my))*16deg)) rotateY(calc((var(--mx) - .5)*18deg)) rotateZ(calc((var(--mx) - .5)*9deg));transition:transform .25s ease-out}.ring{position:absolute;inset:calc(5% + var(--i,0)*4%);border:1px solid hsl(var(--hue) 70% 75% / .16);border-radius:45% 55% 52% 48%;transform:rotate(calc(var(--i,0)*13deg));animation:drift calc(var(--pulse) + var(--i,0)*1s) ease-in-out infinite}.r0{--i:0}.r1{--i:1}.r2{--i:2}.r3{--i:3}.r4{--i:4}.r5{--i:5}.r6{--i:6}.r7{--i:7}.r8{--i:8}.center-mark{position:absolute;left:50%;top:50%;translate:-50% -50%;width:20vmin;height:20vmin;border-radius:50%;display:grid;place-items:center;border:1px solid hsl(var(--hue) 80% 80% / .24);background:radial-gradient(circle,hsl(var(--hue) 55% 40% / .18),rgba(0,0,0,.58));box-shadow:0 0 9vmin hsl(var(--hue) 80% 62% / .18)}.center-mark span{font-size:9vmin;line-height:1;filter:blur(calc(var(--speed)*1.2px));animation:softPulse var(--pulse) ease-in-out infinite}.sense{position:absolute;translate:-50% -50%;width:9vmin;height:9vmin;min-width:54px;min-height:54px;border-radius:50%;border:1px solid hsl(var(--hue) 80% 82% / .2);background:rgba(10,6,4,.5);color:inherit;font-size:clamp(1.4rem,4vw,3.2rem);display:grid;place-items:center;box-shadow:0 18px 60px rgba(0,0,0,.36);transition:scale .35s ease,border-color .35s ease,filter .35s ease,background .35s ease}.sense:hover,.sense.active{scale:1.18;border-color:hsl(var(--hue) 90% 76% / .7);background:hsl(var(--hue) 60% 40% / .16);filter:drop-shadow(0 0 18px hsl(var(--hue) 90% 70% / .4))}.human,.ai{position:absolute;width:18vmin;height:18vmin;border-radius:50%;pointer-events:none;filter:blur(18px);opacity:.7}.human{left:calc(var(--mx)*100% - 9vmin);top:calc(var(--my)*100% - 9vmin);background:hsl(var(--hue) 80% 70% / .32)}.ai{left:calc((1 - var(--mx))*100% - 9vmin);top:calc((1 - var(--my))*100% - 9vmin);background:hsl(calc(var(--hue) + 120) 75% 65% / .24)}.thread{position:absolute;width:100vmax;height:1px;background:linear-gradient(90deg,transparent,hsl(var(--hue) 80% 75% / .22),transparent);rotate:calc((var(--mx) - .5)*70deg + (var(--my) - .5)*35deg);filter:blur(.4px)}.trace{position:absolute;width:11px;height:11px;border-radius:50%;translate:-50% -50%;background:currentColor;box-shadow:0 0 22px currentColor,0 0 60px hsl(var(--hue) 90% 70% / .5);pointer-events:none}.feeling-keys{position:fixed;z-index:5;left:50%;bottom:26px;translate:-50% 0;display:flex;gap:12px;padding:10px 12px;border:1px solid hsl(var(--hue) 70% 80% / .14);border-radius:999px;background:rgba(0,0,0,.26);backdrop-filter:blur(18px)}.feeling-keys button{width:44px;height:44px;border-radius:50%;border:1px solid hsl(var(--hue) 70% 80% / .18);background:rgba(255,255,255,.035);color:inherit;font-size:1.25rem}.feeling-keys button.active{border-color:currentColor;box-shadow:0 0 18px hsl(var(--hue) 85% 70% / .32);background:hsl(var(--hue) 55% 42% / .14)}.barely{position:fixed;right:28px;bottom:34px;color:hsl(var(--hue) 50% 82% / .48);font-size:.82rem;letter-spacing:.24em;text-transform:uppercase;font-family:ui-sans-serif,system-ui,sans-serif}@keyframes breathe{0%,100%{border-radius:var(--curve);filter:blur(.1px)}50%{border-radius:54% 46% 38% 62%;filter:blur(1.2px)}}@keyframes drift{0%,100%{scale:1;rotate:0deg}50%{scale:calc(.94 + var(--depth)*.12);rotate:6deg}}@keyframes softPulse{0%,100%{scale:.96;opacity:.72}50%{scale:1.05;opacity:1}}@media(max-width:720px){.quiet-title{top:16px;left:16px;right:16px}.labyrinth{width:88vmin;height:88vmin}.aperture{width:86vmin;height:86vmin}.feeling-keys{bottom:16px;gap:8px}.feeling-keys button{width:40px;height:40px}.barely{display:none}}@media(prefers-reduced-motion:reduce){.aperture,.ring,.center-mark span{animation:none}.labyrinth,.sense{transition:none}}
`;

export default App;
