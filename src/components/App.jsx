import React, { useEffect, useMemo, useState } from 'react';
import { seedCapsules } from '../data/creationFeed';

const STORAGE_KEY = 'mirror.cartographer.atlas.v2';

const DEFAULT_OBSERVATION = {
  title: "O'Malley: FIV + lymph nodes + breathing concern",
  body: 'FIV-positive cat with multiple enlarged lymph nodes and possible breathing effect. Need to separate FIV baseline from lymphoma, infection, inflammation, or structural compression.',
  domain: 'animal health / retrovirus / diagnostics',
  risk: 'high if breathing is truly affected',
  evidence: 'Known FIV+ status, owner-observed enlarged lymph nodes, possible respiratory effect.',
  unknowns: 'Node cytology, FeLV status, CBC/chemistry/urinalysis, thoracic imaging, viral load/strain, lymphoma status.',
};

const workflowSteps = [
  {
    id: 'observe',
    title: '1. Observe',
    subtitle: 'name the scene without pretending it is solved',
    body: 'Mirror Cartographer starts with the actual visible world: animal, symptom, artifact, feeling, contradiction, image, song, or research question.',
    output: 'A structured observation with domain, risk, evidence, and unknowns.',
  },
  {
    id: 'separate',
    title: '2. Separate layers',
    subtitle: 'stop one label from eating the whole problem',
    body: 'For FIV, the label “FIV+” cannot be allowed to erase lymphoma, infection, anemia, oral disease, lung disease, or stress. Each layer gets its own test path.',
    output: 'Competing hypotheses instead of one collapsed explanation.',
  },
  {
    id: 'test',
    title: '3. Test the next physical hinge',
    subtitle: 'choose the observation that changes reality fastest',
    body: 'The hinge for O’Malley is not a miracle cure claim. It is lymph-node cytology, CBC/chemistry/urinalysis, FeLV confirmation, and thoracic imaging if breathing is affected.',
    output: 'A concrete test/procedure/research method with why, how, result meanings, limits, and next action.',
  },
  {
    id: 'map',
    title: '4. Map the unrealized cure space',
    subtitle: 'current medicine is the wall, not the horizon',
    body: 'The cure map tracks proviral erasure, latency lock, expose-and-clear, entry-proof immune replacement, nonprogressor conversion, and vaccine/prevention design.',
    output: 'A research roadmap that marks what is known, unknown, plausible, dangerous, and testable.',
  },
  {
    id: 'archive',
    title: '5. Archive provenance',
    subtitle: 'make thought inspectable',
    body: 'The repo stores the evolution: maps, logs, assumptions, recommended tests, procedures, research methods, and prevention logic. The website becomes the window into that engine.',
    output: 'A living cognition atlas instead of a vague chatbot.',
  },
];

const cureGates = [
  {
    gate: 'Erase',
    target: 'Integrated FIV provirus',
    method: 'Multiplex CRISPR, base editing, prime editing, or RNA-guided disabling of conserved FIV regions.',
    proof: 'No replication-competent virus after maximal stimulation; acceptable feline-genome off-target profile.',
  },
  {
    gate: 'Lock',
    target: 'Viral transcription / LTR reactivation',
    method: 'Block-and-lock tools: targeted epigenetic repression, CRISPR interference, durable promoter silencing.',
    proof: 'Provirus may remain, but infectious rebound does not occur after inflammatory activation.',
  },
  {
    gate: 'Expose + clear',
    target: 'Latent infected cells',
    method: 'Latency reversal paired with antibodies, therapeutic vaccination, CAR-like feline immune cells, or bispecific clearance.',
    proof: 'Reactivated infected cells are selectively killed without dangerous inflammation or rebound.',
  },
  {
    gate: 'Armor',
    target: 'FIV entry and replication habitat',
    method: 'Entry-resistant immune cells, CD134/CXCR4 separation-of-function mapping, restriction-factor enhancement.',
    proof: 'Feline immune cells remain functional but resist FIV entry/replication.',
  },
  {
    gate: 'Convert ecology',
    target: 'Chronic immune activation / progression terrain',
    method: 'Study long-term nonprogressors, reduce inflammatory sinks, identify protective immune signatures.',
    proof: 'Disease stops progressing with low viral activity and preserved immune function.',
  },
  {
    gate: 'Prevent',
    target: 'FIV-negative cats',
    method: 'Test before mixing, prevent deep bites, indoor/no-roaming design, vet-guided vaccine decision only where available, future DIVA-compatible vaccine design.',
    proof: 'No transmission events, clean testing records, and no false confidence from incomplete vaccine protection.',
  },
];

function safeRead() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function FieldCanvas({ active }) {
  return (
    <div className="mc-orbit" aria-label="Mirror Cartographer field visualization">
      <span className="ring ring-one" />
      <span className="ring ring-two" />
      <span className="ring ring-three" />
      <span className="core" />
      <span className="label north">evidence</span>
      <span className="label east">symbol</span>
      <span className="label south">body</span>
      <span className="label west">unknown</span>
      <strong>{active}</strong>
    </div>
  );
}

function ObservationForm({ observation, setObservation, onRun }) {
  const update = (field, value) => setObservation((current) => ({ ...current, [field]: value }));
  return (
    <section className="mc-panel observation-panel">
      <p className="eyebrow">live input</p>
      <h2>Drop one real-world signal.</h2>
      <label>
        <span>Title</span>
        <input value={observation.title} onChange={(event) => update('title', event.target.value)} />
      </label>
      <label>
        <span>Observation</span>
        <textarea value={observation.body} onChange={(event) => update('body', event.target.value)} />
      </label>
      <div className="two-fields">
        <label>
          <span>Domain</span>
          <input value={observation.domain} onChange={(event) => update('domain', event.target.value)} />
        </label>
        <label>
          <span>Risk</span>
          <input value={observation.risk} onChange={(event) => update('risk', event.target.value)} />
        </label>
      </div>
      <label>
        <span>Known evidence</span>
        <textarea value={observation.evidence} onChange={(event) => update('evidence', event.target.value)} />
      </label>
      <label>
        <span>Unknowns</span>
        <textarea value={observation.unknowns} onChange={(event) => update('unknowns', event.target.value)} />
      </label>
      <button className="primary-action" onClick={onRun}>map this signal</button>
    </section>
  );
}

function ResearchOutput({ observation, runCount }) {
  const tests = useMemo(() => [
    `Clarify immediate danger: ${observation.risk}`,
    'If breathing is affected: resting respiratory rate log, video, gum color check, and vet-directed thoracic imaging.',
    'If lymph nodes are enlarged: anatomical node map and FNA/cytology of the most abnormal accessible node.',
    'Baseline body-state tests: CBC with differential, chemistry panel, urinalysis, FeLV confirmation if not documented.',
    'Research layer: sequence/strain identification, reservoir-cell map, conserved-target search, delivery-platform scoring.',
    'Prevention layer for FIV-negative cats: test before mixing, prevent deep bites, indoor/no-roaming design, vaccine discussion only if available and justified.',
  ], [observation.risk]);

  return (
    <section className="mc-panel result-panel">
      <p className="eyebrow">mapped output #{runCount}</p>
      <h2>{observation.title}</h2>
      <div className="result-grid">
        <article>
          <strong>Observation</strong>
          <p>{observation.body}</p>
        </article>
        <article>
          <strong>Domain</strong>
          <p>{observation.domain}</p>
        </article>
        <article>
          <strong>Known evidence</strong>
          <p>{observation.evidence}</p>
        </article>
        <article>
          <strong>Unknowns</strong>
          <p>{observation.unknowns}</p>
        </article>
      </div>
      <h3>Next physical hinges</h3>
      <ol className="hinge-list">
        {tests.map((test) => <li key={test}>{test}</li>)}
      </ol>
    </section>
  );
}

function PathCard({ step, active, onClick }) {
  return (
    <button className={`path-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{step.title}</span>
      <strong>{step.subtitle}</strong>
      <em>{step.output}</em>
    </button>
  );
}

function App() {
  const saved = typeof window !== 'undefined' ? safeRead() : null;
  const [view, setView] = useState(saved?.view || 'atlas');
  const [activeStep, setActiveStep] = useState(saved?.activeStep || workflowSteps[0].id);
  const [observation, setObservation] = useState(saved?.observation || DEFAULT_OBSERVATION);
  const [runCount, setRunCount] = useState(saved?.runCount || 1);
  const [notice, setNotice] = useState('');

  const active = workflowSteps.find((step) => step.id === activeStep) || workflowSteps[0];

  useEffect(() => {
    const ok = safeWrite({ view, activeStep, observation, runCount });
    setNotice(ok ? '' : 'local browser save unavailable; the atlas still runs in memory');
  }, [view, activeStep, observation, runCount]);

  const runMap = () => {
    setRunCount((count) => count + 1);
    setView('demo');
    setActiveStep('test');
  };

  const exportMap = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      system: 'Mirror Cartographer atlas prototype',
      observation,
      workflowSteps,
      cureGates,
      sourceCapsules: seedCapsules.slice(0, 6).map(({ id, title, type, mood, phrase }) => ({ id, title, type, mood, phrase })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mirror-cartographer-map-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mc-shell">
      <style>{styles}</style>
      <div className="mc-background" />
      <header className="mc-header">
        <button className="brand" onClick={() => setView('atlas')}>Mirror Cartographer</button>
        <nav aria-label="Mirror Cartographer sections">
          {['atlas', 'demo', 'cures', 'prevention', 'engine'].map((item) => (
            <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>
          ))}
        </nav>
      </header>

      {notice && <p className="mc-notice">{notice}</p>}

      {view === 'atlas' && (
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">working atlas prototype</p>
            <h1>A navigable system for turning felt signal into evidence, tests, research maps, and stored provenance.</h1>
            <p className="lead">Not a generic chatbot. Not a static journal. Mirror Cartographer is a cognition interface: it separates layers, names unknowns, chooses physical hinges, and keeps the trail inspectable.</p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => setView('demo')}>run the FIV demo</button>
              <button className="secondary-action" onClick={() => setView('engine')}>show the engine</button>
            </div>
          </div>
          <FieldCanvas active={active.title.replace(/^\d\. /, '')} />
        </section>
      )}

      {view === 'demo' && (
        <section className="demo-grid">
          <ObservationForm observation={observation} setObservation={setObservation} onRun={runMap} />
          <ResearchOutput observation={observation} runCount={runCount} />
        </section>
      )}

      {view === 'cures' && (
        <section className="mc-panel wide-panel">
          <p className="eyebrow">FIV cure-discovery gates</p>
          <h2>Current medicine is the wall. These are the gates that could break it.</h2>
          <div className="gate-grid">
            {cureGates.slice(0, 5).map((gate) => (
              <article key={gate.gate} className="gate-card">
                <span>{gate.gate}</span>
                <h3>{gate.target}</h3>
                <p>{gate.method}</p>
                <strong>Proof needed: {gate.proof}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'prevention' && (
        <section className="mc-panel wide-panel">
          <p className="eyebrow">FIV-negative cat prevention</p>
          <h2>Prevention is exposure architecture first, vaccine decision second.</h2>
          <div className="result-grid">
            <article><strong>Test before mixing</strong><p>Document FIV/FeLV status before introductions, after unknown-risk exposure, and before any vaccine discussion.</p></article>
            <article><strong>Prevent deep bites</strong><p>FIV prevention mostly means preventing fighting: resources, space, slow introductions, separation during stress, and no outdoor roaming.</p></article>
            <article><strong>Vaccine method</strong><p>Where available, the vaccine decision must be vet-guided, risk-based, documented, and understood as incomplete protection with possible antibody-test confusion.</p></article>
            <article><strong>Future vaccine research</strong><p>Better prevention requires subtype coverage, conserved epitopes, DIVA-compatible testing, and proof against heterologous challenge.</p></article>
          </div>
        </section>
      )}

      {view === 'engine' && (
        <section className="engine-layout">
          <div className="mc-panel">
            <p className="eyebrow">workflow spine</p>
            <h2>{active.title}</h2>
            <p>{active.body}</p>
            <strong>{active.output}</strong>
          </div>
          <div className="path-list">
            {workflowSteps.map((step) => (
              <PathCard key={step.id} step={step} active={step.id === activeStep} onClick={() => setActiveStep(step.id)} />
            ))}
          </div>
          <div className="mc-panel">
            <p className="eyebrow">repo as engine</p>
            <h2>What I can build from here</h2>
            <p>I can commit React code, research maps, logs, data files, and public/private corpus structure to GitHub. If Vercel is connected to this repository, it should rebuild from commits. If Vercel is failing because of project settings, environment variables, or domain configuration, that requires Vercel access or deployment logs.</p>
            <button className="secondary-action" onClick={exportMap}>export current map</button>
          </div>
        </section>
      )}
    </main>
  );
}

const styles = `
  :root { color-scheme: dark; --ink: #f8fafc; --dim: #a7b0c3; --line: rgba(255,255,255,.16); --pink: #f0abfc; --blue: #67e8f9; --gold: #fde047; --bg: #030712; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  button, input, textarea { font: inherit; }
  .mc-shell { min-height: 100vh; position: relative; overflow-x: hidden; padding: 22px; }
  .mc-background { position: fixed; inset: 0; z-index: -1; background: radial-gradient(circle at 18% 12%, rgba(240,171,252,.22), transparent 30%), radial-gradient(circle at 82% 22%, rgba(103,232,249,.18), transparent 28%), radial-gradient(circle at 50% 88%, rgba(253,224,71,.10), transparent 32%), linear-gradient(135deg, #020617, #060816 45%, #090015); }
  .mc-header { max-width: 1480px; margin: 0 auto 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .brand, .mc-header nav button, .secondary-action, .primary-action { border: 1px solid var(--line); color: var(--ink); background: rgba(255,255,255,.055); border-radius: 999px; padding: 10px 14px; cursor: pointer; }
  .brand { letter-spacing: .12em; text-transform: uppercase; }
  .mc-header nav { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .mc-header nav button.active { border-color: rgba(103,232,249,.75); background: rgba(103,232,249,.12); }
  .primary-action { background: linear-gradient(135deg, rgba(240,171,252,.92), rgba(103,232,249,.84)); color: #020617; font-weight: 800; border: none; }
  .secondary-action { background: rgba(255,255,255,.07); }
  .hero-grid, .demo-grid, .engine-layout { max-width: 1480px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr); gap: 22px; align-items: stretch; }
  .hero-copy, .mc-panel { border: 1px solid var(--line); border-radius: 34px; background: rgba(255,255,255,.055); box-shadow: 0 24px 90px rgba(0,0,0,.32); padding: clamp(22px, 4vw, 42px); backdrop-filter: blur(18px); }
  .hero-copy h1 { font-size: clamp(2.3rem, 6vw, 6.8rem); line-height: .88; letter-spacing: -.08em; margin: 10px 0 18px; max-width: 1000px; }
  .lead { color: var(--dim); font-size: clamp(1.05rem, 1.8vw, 1.42rem); line-height: 1.5; max-width: 850px; }
  .eyebrow { color: var(--blue); text-transform: uppercase; letter-spacing: .18em; font-size: .76rem; margin: 0 0 10px; }
  .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
  .mc-orbit { min-height: 580px; border: 1px solid var(--line); border-radius: 34px; position: relative; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle, rgba(240,171,252,.12), rgba(2,6,23,.82)); }
  .mc-orbit .ring { position: absolute; border: 1px solid rgba(255,255,255,.2); border-radius: 50%; animation: spin 18s linear infinite; }
  .ring-one { width: 68%; aspect-ratio: 1; border-color: rgba(103,232,249,.35); }
  .ring-two { width: 48%; aspect-ratio: 1.42; border-color: rgba(240,171,252,.38); animation-duration: 24s !important; }
  .ring-three { width: 78%; aspect-ratio: 1.7; border-color: rgba(253,224,71,.25); animation-duration: 31s !important; animation-direction: reverse !important; }
  .core { width: 130px; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, var(--gold), var(--blue) 38%, transparent 70%); filter: blur(.2px); box-shadow: 0 0 80px rgba(103,232,249,.48); }
  .mc-orbit strong { position: absolute; bottom: 34px; max-width: 70%; text-align: center; font-size: clamp(1.2rem, 2vw, 2rem); letter-spacing: -.04em; }
  .label { position: absolute; color: var(--dim); text-transform: uppercase; letter-spacing: .16em; font-size: .72rem; }
  .north { top: 30px; } .south { bottom: 88px; } .east { right: 28px; } .west { left: 28px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .observation-panel label { display: grid; gap: 8px; margin-top: 14px; color: var(--dim); }
  input, textarea { width: 100%; border: 1px solid var(--line); background: rgba(0,0,0,.28); color: var(--ink); border-radius: 18px; padding: 12px 14px; }
  textarea { min-height: 104px; resize: vertical; }
  .two-fields, .result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .result-grid article, .gate-card { border: 1px solid var(--line); border-radius: 24px; background: rgba(0,0,0,.18); padding: 18px; }
  .result-grid p, .gate-card p, .mc-panel p, .path-card em { color: var(--dim); line-height: 1.5; }
  .hinge-list { display: grid; gap: 10px; color: var(--ink); }
  .wide-panel { max-width: 1480px; margin: 0 auto; }
  .wide-panel h2, .mc-panel h2 { font-size: clamp(2rem, 4vw, 4.4rem); line-height: .92; letter-spacing: -.07em; margin: 0 0 18px; }
  .gate-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; margin-top: 22px; }
  .gate-card span { color: var(--gold); text-transform: uppercase; letter-spacing: .16em; font-size: .72rem; }
  .gate-card h3 { font-size: 1.35rem; margin: 10px 0; }
  .gate-card strong { display: block; color: var(--blue); line-height: 1.4; }
  .engine-layout { grid-template-columns: .95fr 1.1fr .95fr; align-items: start; }
  .path-list { display: grid; gap: 10px; }
  .path-card { width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 24px; padding: 18px; color: var(--ink); background: rgba(255,255,255,.05); cursor: pointer; display: grid; gap: 8px; }
  .path-card.active { border-color: rgba(103,232,249,.76); background: rgba(103,232,249,.12); }
  .path-card span { color: var(--gold); font-size: .8rem; text-transform: uppercase; letter-spacing: .15em; }
  .path-card strong { font-size: 1.15rem; }
  .mc-notice { max-width: 1480px; margin: 0 auto 14px; color: var(--gold); border: 1px solid rgba(253,224,71,.3); border-radius: 999px; padding: 10px 14px; background: rgba(253,224,71,.08); }
  @media (max-width: 920px) { .mc-shell { padding: 14px; } .mc-header, .hero-grid, .demo-grid, .engine-layout { grid-template-columns: 1fr; } .mc-header { align-items: flex-start; flex-direction: column; } .two-fields, .result-grid { grid-template-columns: 1fr; } .mc-orbit { min-height: 430px; } }
`;

export default App;
