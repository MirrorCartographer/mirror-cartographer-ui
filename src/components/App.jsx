import React, { useEffect, useMemo, useRef, useState } from 'react';

const sources = [
  ['Agentic browsing', 'AI is moving into browsers where agents can inspect pages, tabs, and workflows.'],
  ['Software agents', 'Coding tools now plan, edit, review, and commit changes across repositories.'],
  ['Deep research', 'Research agents can gather and synthesize sources, but uncertainty must stay visible.'],
  ['Grounded interfaces', 'The hard problem is connecting goals to screens, files, state, and user control.']
];

const modes = {
  signal: { name: 'Signal', color: '#7dd3fc', rule: 'Extract observable inputs before interpretation.' },
  frame: { name: 'Frame', color: '#f0abfc', rule: 'Choose the lens: technical, symbolic, practical, ethical, or evidence-based.' },
  evidence: { name: 'Evidence', color: '#fde68a', rule: 'Mark what is sourced, plausible, unproven, or speculative.' },
  build: { name: 'Build', color: '#86efac', rule: 'Convert the result into a working artifact the user can operate.' }
};

const advantages = [
  'You test AI with compressed fragments instead of neat product requirements.',
  'Our work created a reusable context-switch protocol: detect lens, show why it changed, expose what it enables.',
  'The strongest version keeps imagination and reality-testing separate until they are intentionally braided.',
  'The output standard is not advice. It is proof: GitHub commits, interactive surfaces, and usable artifacts.'
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function analyze(text) {
  const lower = text.toLowerCase();
  const count = (words) => words.filter((word) => lower.includes(word)).length;
  return {
    signal: clamp(22 + count(['felt', 'saw', 'heard', 'smelled', 'pulse', 'image', 'sound']) * 14, 5, 100),
    frame: clamp(28 + count(['symbol', 'archetype', 'context', 'meaning', 'pattern', 'mirror']) * 13, 5, 100),
    evidence: clamp(24 + count(['research', 'source', 'current', 'capability', 'prove', 'real', 'evidence']) * 15, 5, 100),
    build: clamp(26 + count(['build', 'code', 'website', 'github', 'vercel', 'ship', 'make']) * 16, 5, 100)
  };
}

function useAnimation(mode, scores) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let start = Date.now();
    const points = Array.from({ length: 96 }, (_, i) => ({
      i,
      a: (Math.PI * 2 * i) / 96,
      r: 40 + Math.random() * 250,
      s: 0.4 + Math.random() * 1.4
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    const drawLabel = (txt, x, y, size, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff8ef';
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(txt, x, y);
      ctx.restore();
    };
    const loop = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const t = ((Date.now() - start) % 30000) / 1000;
      const scene = Math.floor(t / 5);
      const p = (t % 5) / 5;
      const cx = w / 2;
      const cy = h / 2;
      const active = modes[mode];
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h));
      bg.addColorStop(0, `${active.color}33`);
      bg.addColorStop(0.48, '#090917');
      bg.addColorStop(1, '#02030a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      points.forEach((node) => {
        const orbit = node.r + Math.sin(t * node.s + node.i) * 24 + scene * 9;
        const x = Math.cos(node.a + t * 0.09) * orbit;
        const y = Math.sin(node.a * 1.7 + t * 0.07) * orbit * 0.55;
        const palette = ['#7dd3fc', '#f0abfc', '#fde68a', '#86efac'];
        ctx.fillStyle = palette[node.i % 4];
        ctx.globalAlpha = 0.25 + Math.sin(t + node.i) * 0.18;
        ctx.beginPath();
        ctx.arc(x, y, 2 + node.s, 0, Math.PI * 2);
        ctx.fill();
        if (node.i % 8 === 0) {
          ctx.strokeStyle = palette[node.i % 4];
          ctx.globalAlpha = 0.08;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      });
      ctx.restore();
      const labels = ['INPUT', 'ROUTING', 'EVIDENCE', 'SIMULATION', 'COMMIT', 'LOOP'];
      const sub = ['fragments arrive', 'context becomes visible', 'claims get ranked', 'interface becomes playable', 'artifact ships', 'user changes the next state'];
      ctx.strokeStyle = active.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 70 + scene * 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawLabel(labels[scene], cx, cy - 4, Math.min(40, w / 13), 0.95);
      drawLabel(sub[scene], cx, cy + 30, Math.min(16, w / 34), 0.72);
      ctx.fillStyle = '#fff8ef';
      ctx.globalAlpha = 0.62;
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`30 second in-browser animation · ${t.toFixed(1)}s`, 20, 28);
      ctx.textAlign = 'right';
      ctx.fillText(`${active.name} ${Math.round(scores[mode])}%`, w - 20, 28);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    resize();
    loop();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [mode, scores]);
  return ref;
}

function Meter({ id, value, active, onClick }) {
  const mode = modes[id];
  return <button className={active ? 'meter active' : 'meter'} onClick={onClick} style={{ '--c': mode.color }}><span>{mode.name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{Math.round(value)}%</strong></button>;
}

export default function App() {
  const [text, setText] = useState('Research current AI capability, decide what is real, use our context work, and build proof in the website.');
  const [mode, setMode] = useState('evidence');
  const scores = useMemo(() => analyze(text), [text]);
  const canvasRef = useAnimation(mode, scores);
  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const active = modes[mode];

  return (
    <main className="site" style={{ '--accent': active.color }}>
      <style>{css}</style>
      <section className="hero">
        <div className="copy">
          <p className="eyebrow">Reality Console / Mirror Cartographer</p>
          <h1>The interface is the proof.</h1>
          <p className="lede">This replaces the arcade with a site about the actual frontier: AI agents, research, coding, browser control, and the unique protocol built from our work together.</p>
          <div className="buttons">{Object.keys(modes).map((key) => <button key={key} onClick={() => setMode(key)}>{modes[key].name}</button>)}</div>
        </div>
        <div className="video"><canvas ref={canvasRef} /><div><b>30-second animation video</b><span>generated live with canvas, not a static image</span></div></div>
      </section>
      <section className="section grid">
        <article className="panel">
          <p className="eyebrow">Reality Determination</p>
          <h2>Separate the layers before believing the story.</h2>
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
          <div className="meters">{Object.keys(modes).map((key) => <Meter key={key} id={key} value={scores[key]} active={mode === key} onClick={() => setMode(key)} />)}</div>
          <p className="read"><b>Dominant layer:</b> {modes[strongest].name}. {modes[strongest].rule}</p>
        </article>
        <article className="panel activePanel">
          <p className="eyebrow">Active mode</p>
          <h2>{active.name}</h2>
          <p>{active.rule}</p>
          <div className="protocol"><b>Protocol</b><ol><li>Capture the input.</li><li>Route the context visibly.</li><li>Rank evidence and uncertainty.</li><li>Build a reversible artifact.</li></ol></div>
        </article>
      </section>
      <section className="section">
        <p className="eyebrow">Current frontier</p>
        <h2 className="title">What the web says AI is becoming.</h2>
        <div className="cards">{sources.map(([title, body]) => <article key={title}><b>{title}</b><p>{body}</p></article>)}</div>
      </section>
      <section className="section grid">
        <article className="panel dark">
          <p className="eyebrow">The advantage from our work</p>
          <h2>Not a chatbot. A context machine.</h2>
          <p>Most AI demos hide the most important act: how the system decides what kind of problem it is solving. This site exposes that decision.</p>
        </article>
        <div className="list">{advantages.map((item) => <article key={item}>{item}</article>)}</div>
      </section>
      <section className="section close"><p className="eyebrow">Thesis</p><h2>Future AI interfaces will not only answer. They will show their routing, evidence, uncertainty, and build path.</h2></section>
    </main>
  );
}

const css = `
*{box-sizing:border-box}body{margin:0;background:#03040a;color:#fff8ef;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,textarea{font:inherit}.site{min-height:100vh;background:radial-gradient(circle at 10% 10%,rgba(125,211,252,.17),transparent 34%),radial-gradient(circle at 90% 4%,rgba(240,171,252,.15),transparent 32%),linear-gradient(180deg,#03040a,#0c0712 48%,#03040a)}.hero{min-height:100vh;width:min(1340px,100%);margin:0 auto;display:grid;grid-template-columns:.9fr 1.1fr;gap:30px;align-items:center;padding:70px 22px}.eyebrow{margin:0 0 14px;text-transform:uppercase;letter-spacing:.18em;color:#fde68a;font-size:12px;font-weight:950}.hero h1{font-size:clamp(64px,10vw,148px);line-height:.75;letter-spacing:-.1em;margin:0 0 24px}.lede{font-size:clamp(18px,2.1vw,28px);line-height:1.36;color:#e9ddec;max-width:850px}.buttons{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.buttons button,.meter{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff8ef;border-radius:999px;padding:12px 16px;font-weight:950;cursor:pointer}.buttons button:hover{background:var(--accent);color:#03040a}.video,.panel{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);box-shadow:0 30px 100px rgba(0,0,0,.36);backdrop-filter:blur(18px);border-radius:34px}.video{padding:14px}.video canvas{display:block;width:100%;height:min(68vh,680px);min-height:420px;border-radius:26px;background:#03040a}.video div{display:flex;justify-content:space-between;gap:12px;padding:14px 6px 4px;color:#d9d0df}.video b{color:#fff8ef}.section{width:min(1240px,100%);margin:0 auto;padding:62px 22px}.grid{display:grid;grid-template-columns:1.08fr .92fr;gap:20px}.panel{padding:26px}.panel h2,.title,.close h2{font-size:clamp(38px,5.7vw,82px);line-height:.88;letter-spacing:-.075em;margin:0 0 18px}.panel p{font-size:18px;line-height:1.55;color:#e4d9e7}textarea{width:100%;min-height:132px;border-radius:24px;border:1px solid rgba(255,255,255,.14);background:#060712;color:#fff8ef;padding:18px;font-size:18px;line-height:1.45;resize:vertical}.meters{display:grid;gap:12px;margin-top:18px}.meter{display:grid;grid-template-columns:80px 1fr 52px;gap:12px;align-items:center;text-align:left}.meter i{height:12px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.meter b{display:block;height:100%;background:var(--c);border-radius:999px}.meter.active{border-color:var(--c);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 20%,transparent)}.read{border-left:4px solid var(--accent);padding-left:16px}.activePanel{border-color:color-mix(in srgb,var(--accent) 38%,rgba(255,255,255,.15))}.activePanel h2{color:var(--accent)}.protocol{margin-top:22px;border:1px solid color-mix(in srgb,var(--accent) 32%,rgba(255,255,255,.12));border-radius:24px;padding:18px;background:rgba(0,0,0,.2)}.protocol b{color:var(--accent)}.protocol li{margin:8px 0;color:#e7ddec}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.cards article,.list article{border:1px solid rgba(255,255,255,.13);background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.035));border-radius:28px;padding:22px}.cards b{display:block;font-size:22px}.cards p,.dark p{color:#e4d9e7;line-height:1.55}.dark{background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(0,0,0,.25));border-color:rgba(255,255,255,.18)}.list{display:grid;grid-template-columns:1fr 1fr;gap:16px}.list article{font-size:18px;line-height:1.5}.close{padding-bottom:120px}.close h2{max-width:1100px}@media(max-width:960px){.hero,.grid,.cards,.list{grid-template-columns:1fr}.hero{padding-top:54px}.video canvas{height:440px}.hero h1{font-size:clamp(58px,17vw,100px)}.video div{display:block}.meter{grid-template-columns:74px 1fr 42px}}
`;
