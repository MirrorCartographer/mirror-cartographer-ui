import React, { useEffect, useMemo, useRef, useState } from 'react';

const labs = [
  { id: 'forge', name: 'System Forge', icon: '⚙️', color: '#7dd3fc', skill: 'architecture', detail: 'Turns fuzzy requests into objects, rules, states, and testable outputs.' },
  { id: 'arcade', name: 'Logic Arcade', icon: '🧩', color: '#facc15', skill: 'reasoning', detail: 'Converts patterns into scoring rules, constraints, and solvable puzzles.' },
  { id: 'field', name: 'Particle Field', icon: '✦', color: '#f0abfc', skill: 'generative UI', detail: 'A living canvas driven by your pointer, selected module, and energy level.' },
  { id: 'story', name: 'Story Engine', icon: '📜', color: '#fb7185', skill: 'narrative systems', detail: 'Builds tone-controlled micro-worlds from small symbolic inputs.' },
  { id: 'ship', name: 'Ship Room', icon: '🚀', color: '#86efac', skill: 'deployment thinking', detail: 'Shows the exact production chain: idea → state → interface → commit → deploy.' }
];

const commandWords = ['build', 'map', 'test', 'animate', 'explain', 'ship', 'debug', 'make weird', 'make useful'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0018,
    vy: (Math.random() - 0.5) * 0.0018,
    r: 1 + Math.random() * 2.8,
    phase: Math.random() * Math.PI * 2
  }));
}

function useParticleField(activeLab, energy) {
  const canvasRef = useRef(null);
  const particles = useRef(makeParticles(110));
  const pointer = useRef({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    let raf = 0;
    const lab = labs.find((x) => x.id === activeLab) || labs[0];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * window.devicePixelRatio);
      canvas.height = Math.floor(rect.height * window.devicePixelRatio);
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
        active: true
      };
    };

    const leave = () => { pointer.current.active = false; };

    const draw = () => {
      frame += 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createRadialGradient(w * pointer.current.x, h * pointer.current.y, 10, w * 0.5, h * 0.5, Math.max(w, h));
      gradient.addColorStop(0, `${lab.color}33`);
      gradient.addColorStop(1, '#03040a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const speed = 0.4 + energy / 60;
      particles.current.forEach((p, index) => {
        const dx = pointer.current.x - p.x;
        const dy = pointer.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = pointer.current.active ? (0.00004 * energy) / dist : 0;
        p.vx += dx * force;
        p.vy += dy * force;
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        p.vx *= 0.992;
        p.vy *= 0.992;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        p.x = clamp(p.x, 0, 1);
        p.y = clamp(p.y, 0, 1);
        const pulse = Math.sin(frame * 0.03 + p.phase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.fillStyle = index % 6 === 0 ? lab.color : `rgba(255,248,239,${0.25 + pulse * 0.55})`;
        ctx.arc(p.x * w, p.y * h, p.r + pulse * 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < particles.current.length; i += 1) {
        for (let j = i + 1; j < particles.current.length; j += 9) {
          const a = particles.current[i];
          const b = particles.current[j];
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 118) {
            ctx.strokeStyle = `rgba(255,248,239,${0.11 * (1 - d / 118)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, [activeLab, energy]);

  return canvasRef;
}

function compilePrompt(input, activeLab, energy) {
  const text = input.toLowerCase();
  const detected = commandWords.filter((word) => text.includes(word));
  const lab = labs.find((x) => x.id === activeLab) || labs[0];
  const verbs = detected.length ? detected : ['interpret', 'structure', 'prototype'];
  const difficulty = clamp(Math.round(input.length / 12 + energy / 14 + detected.length * 3), 1, 20);
  return {
    name: `${lab.name} / ${verbs[0].toUpperCase()} MODE`,
    difficulty,
    steps: [
      `Parse request through ${lab.skill}.`,
      `Extract commands: ${verbs.join(', ')}.`,
      `Generate a playable proof instead of a paragraph.`,
      `Expose state so the user can argue with the system.`,
      `Ship the smallest impressive version, then iterate.`
    ],
    output: `I would build a ${lab.name.toLowerCase()} artifact with ${difficulty} moving parts, tuned to ${energy}% intensity.`
  };
}

function MiniGame({ energy, activeLab }) {
  const [score, setScore] = useState(0);
  const [targets, setTargets] = useState(() => Array.from({ length: 7 }, (_, i) => ({ id: i, hit: false, x: 8 + Math.random() * 82, y: 14 + Math.random() * 68 })));
  const lab = labs.find((x) => x.id === activeLab) || labs[0];
  const remaining = targets.filter((x) => !x.hit).length;

  const hit = (id) => {
    setTargets((items) => items.map((item) => item.id === id ? { ...item, hit: true } : item));
    setScore((s) => s + 10 + Math.round(energy / 10));
  };

  const reset = () => {
    setScore(0);
    setTargets(Array.from({ length: 7 }, (_, i) => ({ id: i, hit: false, x: 8 + Math.random() * 82, y: 14 + Math.random() * 68 })));
  };

  return (
    <div className="game" style={{ '--accent': lab.color }}>
      <div className="gameTop"><b>Click the context nodes</b><span>score {score}</span><span>{remaining} left</span></div>
      <div className="arena">
        {targets.map((target) => !target.hit && <button key={target.id} className="target" style={{ left: `${target.x}%`, top: `${target.y}%` }} onClick={() => hit(target.id)}>{lab.icon}</button>)}
        {remaining === 0 && <div className="win"><b>System aligned.</b><span>You cleared the board. That is the game loop: sense → act → state changes.</span><button onClick={reset}>play again</button></div>}
      </div>
    </div>
  );
}

export default function App() {
  const [activeLab, setActiveLab] = useState('forge');
  const [energy, setEnergy] = useState(67);
  const [prompt, setPrompt] = useState('Build me something weird, useful, animated, and real.');
  const [log, setLog] = useState(['boot: arcade loaded', 'state: interactive', 'rule: no static brochure']);
  const canvasRef = useParticleField(activeLab, energy);
  const lab = labs.find((x) => x.id === activeLab) || labs[0];
  const compiled = useMemo(() => compilePrompt(prompt, activeLab, energy), [prompt, activeLab, energy]);
  const stats = useMemo(() => [
    ['components', 12],
    ['state hooks', 7],
    ['live systems', 4],
    ['fun level', `${energy}%`]
  ], [energy]);

  const addLog = (message) => setLog((items) => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${message}`, ...items].slice(0, 8));

  return (
    <main className="page" style={{ '--accent': lab.color }}>
      <style>{styles}</style>
      <section className="hero">
        <canvas ref={canvasRef} className="space" />
        <div className="heroContent">
          <p className="eyebrow">Mirror Cartographer / AI Skill Arcade</p>
          <h1>Play the machine.</h1>
          <p className="lede">Not a brochure. A small interactive lab showing UI engineering, state design, animation, simulation, prompt compilation, game loops, and deployment-oriented thinking.</p>
          <div className="controls">
            <label>Energy <b>{energy}%</b><input type="range" min="15" max="100" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} /></label>
            <button onClick={() => addLog(`activated ${lab.name}`)}>pulse selected lab</button>
            <button onClick={() => addLog('generated new proof path')}>generate proof path</button>
          </div>
        </div>
      </section>

      <section className="section labs">
        {labs.map((item) => <button key={item.id} onClick={() => { setActiveLab(item.id); addLog(`switched to ${item.name}`); }} className={item.id === activeLab ? 'lab active' : 'lab'} style={{ '--accent': item.color }}><span>{item.icon}</span><b>{item.name}</b><small>{item.skill}</small></button>)}
      </section>

      <section className="section grid">
        <article className="panel big">
          <p className="eyebrow">Active lab</p>
          <h2>{lab.icon} {lab.name}</h2>
          <p>{lab.detail}</p>
          <div className="statGrid">{stats.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
        </article>
        <article className="panel">
          <p className="eyebrow">Prompt compiler</p>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="compiled"><b>{compiled.name}</b><span>difficulty {compiled.difficulty}/20</span><p>{compiled.output}</p></div>
        </article>
      </section>

      <section className="section grid reverse">
        <article className="panel">
          <p className="eyebrow">Compiler steps</p>
          <ol className="steps">{compiled.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </article>
        <MiniGame energy={energy} activeLab={activeLab} />
      </section>

      <section className="section grid">
        <article className="panel terminal">
          <p className="eyebrow">Live build log</p>
          {log.map((item) => <code key={item}>{item}</code>)}
        </article>
        <article className="panel manifesto">
          <p className="eyebrow">What this shows</p>
          <h2>Good AI software should feel like an instrument.</h2>
          <p>It should respond when touched, expose its state, let the user steer, and turn abstract thought into something visible enough to fight with. That is what this page is built to prove.</p>
        </article>
      </section>
    </main>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#03040a;color:#fff8ef;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,textarea{font:inherit}.page{min-height:100vh;background:#03040a;overflow:hidden}.hero{min-height:96vh;position:relative;display:grid;place-items:center;padding:72px 20px}.space{position:absolute;inset:0;width:100%;height:100%;filter:saturate(1.15)}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,4,10,.1),#03040a 96%);pointer-events:none}.heroContent{position:relative;z-index:1;width:min(1180px,100%)}.eyebrow{margin:0 0 14px;text-transform:uppercase;letter-spacing:.19em;color:#fde68a;font-size:12px;font-weight:950}.hero h1{font-size:clamp(66px,13vw,170px);letter-spacing:-.105em;line-height:.75;margin:0 0 24px;text-wrap:balance}.lede{max-width:940px;color:#eadfec;font-size:clamp(19px,2.35vw,30px);line-height:1.34}.controls{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}.controls label,.controls button,.lab,.panel{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.075);box-shadow:0 24px 90px rgba(0,0,0,.32);backdrop-filter:blur(16px)}.controls label{display:flex;align-items:center;gap:14px;border-radius:999px;padding:12px 16px;font-weight:900}.controls input{accent-color:var(--accent)}.controls button,.win button{color:#03040a;background:var(--accent);border:0;border-radius:999px;padding:12px 16px;font-weight:950;cursor:pointer}.section{width:min(1240px,100%);margin:0 auto;padding:54px 20px}.labs{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:-90px;position:relative;z-index:2}.lab{color:#fff8ef;border-radius:28px;padding:22px;text-align:left;cursor:pointer;min-height:160px;transition:.22s ease}.lab:hover,.lab.active{transform:translateY(-8px);border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent),0 30px 90px rgba(0,0,0,.38)}.lab span{display:block;font-size:38px}.lab b{display:block;font-size:22px;margin:16px 0 6px}.lab small{color:#d8d0df;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.reverse{grid-template-columns:.8fr 1.2fr}.panel,.game{border-radius:34px;padding:26px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.04));box-shadow:0 28px 90px rgba(0,0,0,.28)}.panel h2{font-size:clamp(38px,5.7vw,78px);line-height:.87;letter-spacing:-.075em;margin:0 0 18px}.panel p{color:#e5dbe7;line-height:1.55;font-size:18px}.big{border-color:color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.14))}.statGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}.statGrid div{border-radius:22px;background:rgba(0,0,0,.22);padding:18px;border:1px solid rgba(255,255,255,.11)}.statGrid b{display:block;font-size:30px;color:var(--accent)}.statGrid span{color:#dcd3e3;text-transform:uppercase;font-size:12px;letter-spacing:.12em;font-weight:900}textarea{width:100%;min-height:150px;border-radius:24px;border:1px solid rgba(255,255,255,.16);background:#080914;color:#fff8ef;padding:18px;font-size:18px;line-height:1.45;resize:vertical}.compiled{margin-top:14px;border-left:4px solid var(--accent);padding:14px 0 14px 18px}.compiled b,.compiled span{display:block}.compiled span{color:var(--accent);font-weight:900;margin-top:5px}.steps{display:grid;gap:12px;margin:0;padding-left:20px}.steps li{padding:14px 16px;border-radius:18px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.1);line-height:1.45}.game{border-color:color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.14))}.gameTop{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px;font-weight:950}.arena{position:relative;min-height:420px;border-radius:28px;overflow:hidden;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 38%),linear-gradient(135deg,rgba(255,255,255,.08),rgba(0,0,0,.2));border:1px solid rgba(255,255,255,.12)}.target{position:absolute;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:color-mix(in srgb,var(--accent) 65%,#fff);box-shadow:0 0 40px color-mix(in srgb,var(--accent) 44%,transparent);font-size:24px;animation:float 1.6s ease-in-out infinite alternate;cursor:pointer}.win{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:28px;background:rgba(3,4,10,.82)}.win b{font-size:40px;letter-spacing:-.05em}.win span{display:block;max-width:460px;color:#eadfec;margin:8px auto 18px}.terminal{display:grid;gap:10px}.terminal code{display:block;padding:12px 14px;border-radius:16px;background:#05060d;border:1px solid rgba(255,255,255,.1);color:#b7f7d0}.manifesto{border-color:color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.14))}.manifesto h2{font-size:clamp(36px,5vw,72px)}@keyframes float{from{margin-top:-6px}to{margin-top:8px}}@media(max-width:900px){.labs,.grid,.reverse,.statGrid{grid-template-columns:1fr}.labs{margin-top:-40px}.hero{min-height:82vh}.hero h1{font-size:clamp(60px,18vw,104px)}.arena{min-height:330px}}
`;
