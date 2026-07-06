import React, { useMemo, useState } from 'react';

const contexts = [
  {
    id: 'builder',
    name: 'Builder',
    color: '#7dd3fc',
    description: 'Turns intent into executable systems.',
    signals: ['build', 'code', 'github', 'vercel', 'app', 'website', 'system', 'proof', 'tool', 'demo'],
    assumptions: ['The user wants a working artifact.', 'Constraints should become interface rules.'],
    enables: ['architecture', 'implementation steps', 'test surfaces', 'shipping plan'],
    suppresses: ['vague abstraction', 'pure commentary'],
    answer: 'Build the object. Show state, transitions, and a proof surface the user can operate.'
  },
  {
    id: 'symbolic',
    name: 'Symbolic',
    color: '#f0abfc',
    description: 'Reads image, archetype, rhythm, and resonance as structured data.',
    signals: ['mirror', 'symbol', 'archetype', 'ocean', 'drum', 'pulse', 'glyph', 'dream', 'ritual', 'thread'],
    assumptions: ['Symbols are compressed state.', 'Metaphor becomes useful when mapped.'],
    enables: ['archetype mapping', 'emotion-to-symbol translation', 'narrative coherence'],
    suppresses: ['over-literal reduction', 'premature flattening'],
    answer: 'Name the symbol, locate it in body or story, map the archetype, and choose an embodied action.'
  },
  {
    id: 'stability',
    name: 'Stability',
    color: '#86efac',
    description: 'Protects pacing, embodiment, reality-testing, and safe next action.',
    signals: ['overload', 'fear', 'risk', 'health', 'sleep', 'anchor', 'ground', 'steady', 'safe'],
    assumptions: ['High-meaning states need calibration.', 'Good systems include exits and anchors.'],
    enables: ['pacing', 'grounding', 'state check', 'ordinary next step'],
    suppresses: ['escalation', 'unbounded loops'],
    answer: 'Keep the meaning, reduce intensity, and convert the next move into something grounded and reversible.'
  },
  {
    id: 'research',
    name: 'Research',
    color: '#fde68a',
    description: 'Separates claim, evidence, uncertainty, and tests.',
    signals: ['research', 'source', 'evidence', 'prove', 'test', 'paper', 'data', 'study', 'hypothesis'],
    assumptions: ['Claims need visible support.', 'Novel ideas need pressure-testing.'],
    enables: ['evidence ledger', 'hypothesis test', 'unknowns list', 'falsification path'],
    suppresses: ['unsupported certainty', 'story-only answers'],
    answer: 'Split the idea into known, plausible, unproven, and testable; then design the smallest honest test.'
  },
  {
    id: 'plain',
    name: 'Plain Reality',
    color: '#e5e7eb',
    description: 'Answers directly without extra mythology.',
    signals: ['simple', 'plain', 'generic', 'real', 'honest', 'direct', 'normal', 'actually'],
    assumptions: ['Sometimes direct is highest value.', 'Not every signal should be amplified.'],
    enables: ['short answer', 'clean distinction', 'ordinary action'],
    suppresses: ['excessive framing', 'ornament'],
    answer: 'Say what is true, what is unknown, and what concrete thing to do next.'
  }
];

const examples = [
  'Build proof in GitHub and show why the context changed.',
  'The ocean, drums, mirror, and pulse feel connected.',
  'Give me the plain answer with no mythology.',
  'Prove the claim with sources and tests.',
  'Make this steady and usable.'
];

function rankContexts(prompt) {
  const text = prompt.toLowerCase();
  return contexts.map((context) => {
    const hits = context.signals.filter((signal) => text.includes(signal));
    const buildBoost = context.id === 'builder' && /build|code|github|vercel|website|app/.test(text) ? 0.3 : 0;
    const score = Math.min(0.99, 0.08 + hits.length * 0.14 + buildBoost);
    return { ...context, hits, score };
  }).sort((a, b) => b.score - a.score);
}

function answerFor(prompt, context) {
  const next = {
    builder: 'Next: expose candidate contexts, chosen frame, reason, enabled inferences, and manual override.',
    symbolic: 'Next: turn the image into a context object rather than a mood.',
    stability: 'Next: create a clear entry, exit, and reset rule.',
    research: 'Next: write claims as tests and mark evidence level.',
    plain: 'Next: keep only what survives a direct explanation.'
  }[context.id];
  return `${context.answer} ${next}`;
}

export default function App() {
  const [prompt, setPrompt] = useState('Build proof in GitHub and show why the context changed.');
  const [forced, setForced] = useState(null);
  const ranked = useMemo(() => rankContexts(prompt), [prompt]);
  const selected = forced ? ranked.find((c) => c.id === forced) || ranked[0] : ranked[0];
  const reason = selected.hits.length
    ? `${selected.name} is active because it matched: ${selected.hits.join(', ')}.`
    : `${selected.name} is active by default because no stronger signal won.`;

  return (
    <main className="page">
      <style>{styles}</style>
      <section className="hero">
        <p className="eyebrow">Mirror Cartographer / Context Engine</p>
        <h1>Context is visible now.</h1>
        <p className="lede">This is the proof: the site does not just answer. It shows the context candidates, why one won, what it enables, what it suppresses, and how the same prompt changes when you switch frames.</p>
        <div className="inputPanel">
          <label>Prompt</label>
          <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setForced(null); }} />
          <div className="examples">{examples.map((x) => <button key={x} onClick={() => { setPrompt(x); setForced(null); }}>{x}</button>)}</div>
        </div>
      </section>

      <section className="section grid">
        <div>
          <p className="eyebrow">Router</p>
          <h2>Candidate contexts compete.</h2>
          <p>Click a context to override the automatic router. The answer updates because the assumptions changed.</p>
        </div>
        <div className="panel">
          <div className="pills">{ranked.map((context) => <button className={context.id === selected.id ? 'pill active' : 'pill'} style={{ '--accent': context.color }} key={context.id} onClick={() => setForced(context.id)}><span>{context.name}</span><b>{Math.round(context.score * 100)}%</b></button>)}</div>
          <p className="reason"><b>Chosen:</b> {selected.name}<br /><b>Reason:</b> {reason}</p>
        </div>
      </section>

      <section className="section two">
        <article className="panel" style={{ '--accent': selected.color }}>
          <p className="eyebrow">Active context object</p>
          <h3>{selected.name}</h3>
          <p>{selected.description}</p>
          <div className="lists"><div><b>Assumptions</b>{selected.assumptions.map((x) => <span key={x}>{x}</span>)}</div><div><b>Enables</b>{selected.enables.map((x) => <span key={x}>{x}</span>)}</div><div><b>Suppresses</b>{selected.suppresses.map((x) => <span key={x}>{x}</span>)}</div></div>
        </article>
        <article className="panel answer" style={{ '--accent': selected.color }}>
          <p className="eyebrow">Output</p>
          <h3>Answer through {selected.name}</h3>
          <p>{answerFor(prompt, selected)}</p>
          <button className="reset" onClick={() => setForced(null)}>Return to automatic router</button>
        </article>
      </section>

      <section className="section dark">
        <p className="eyebrow">Multi-context comparison</p>
        <h2>Same input. Different reasoning surface.</h2>
        <div className="answers">{contexts.map((context) => <article key={context.id} style={{ '--accent': context.color }}><b>{context.name}</b><p>{answerFor(prompt, context)}</p></article>)}</div>
      </section>

      <section className="section final">
        <p className="eyebrow">Claim</p>
        <h2>This is not hidden magic. It is inspectable routing.</h2>
        <p className="lede">Current chat systems compress context selection into the final answer. This prototype makes that selection an object the user can see, challenge, edit, and reuse.</p>
      </section>
    </main>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#04050a;color:#fff8ef;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;background:radial-gradient(circle at 12% 4%,rgba(125,211,252,.2),transparent 30%),radial-gradient(circle at 84% 0%,rgba(240,171,252,.18),transparent 28%),linear-gradient(180deg,#04050a,#110817 52%,#04050a)}.hero{min-height:90vh;display:grid;place-content:center;padding:72px 22px}.hero>*{width:min(1180px,100%)}.eyebrow{margin:0 0 14px;text-transform:uppercase;letter-spacing:.18em;color:#fde68a;font-size:12px;font-weight:900}.hero h1{font-size:clamp(56px,10vw,138px);line-height:.78;letter-spacing:-.09em;margin:0 0 24px}.lede{font-size:clamp(18px,2.2vw,28px);line-height:1.36;color:#eadfec;max-width:1000px}.inputPanel,.panel{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);border-radius:30px;padding:22px;box-shadow:0 28px 90px rgba(0,0,0,.28)}.inputPanel{margin-top:32px}label{display:block;font-weight:900;margin-bottom:10px}textarea{width:100%;min-height:116px;border:1px solid rgba(255,255,255,.18);background:#080812;color:#fff8ef;border-radius:22px;padding:18px;font:inherit;font-size:18px;line-height:1.45;resize:vertical}.examples{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}button{cursor:pointer}.examples button,.reset{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff8ef;border-radius:999px;padding:10px 14px;font-weight:800}.section{width:min(1220px,100%);margin:0 auto;padding:72px 22px}.section h2{font-size:clamp(36px,5.8vw,78px);line-height:.88;letter-spacing:-.07em;margin:0 0 20px}.grid,.two{display:grid;grid-template-columns:1fr 1.2fr;gap:22px}.pills{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.pill{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:#fff8ef;border-radius:18px;padding:14px;font-weight:900}.pill b{color:var(--accent)}.pill.active{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,transparent),rgba(255,255,255,.07))}.reason{line-height:1.55;color:#e7ddec}.panel h3{font-size:34px;margin:0 0 12px}.lists{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.lists div{border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:14px;background:rgba(0,0,0,.18)}.lists b{display:block;color:var(--accent);margin-bottom:10px}.lists span{display:block;color:#ded4e4;font-size:14px;line-height:1.42;margin:8px 0}.answer{border-color:color-mix(in srgb,var(--accent) 42%,rgba(255,255,255,.12))}.answer p{font-size:22px;line-height:1.45}.dark{width:100%;max-width:none;background:linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.025));border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}.dark>*{width:min(1220px,100%);margin-left:auto;margin-right:auto}.answers{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.answers article{border:1px solid color-mix(in srgb,var(--accent) 38%,rgba(255,255,255,.12));border-radius:24px;padding:18px;background:rgba(255,255,255,.055)}.answers b{color:var(--accent)}.answers p{line-height:1.45;color:#e6dce8}.final{padding-bottom:110px}@media (max-width:880px){.hero{min-height:auto}.grid,.two{grid-template-columns:1fr}.pills,.lists,.answers{grid-template-columns:1fr}.section{padding:50px 16px}.hero h1{font-size:clamp(52px,16vw,92px)}}
`;
