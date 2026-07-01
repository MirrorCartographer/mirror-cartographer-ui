import React, { useEffect, useMemo, useState } from 'react';
import archiveManifest from '../data/mcArchiveManifest.json';

const STORAGE_KEY = 'mirror.cartographer.operating.site.v1';

const operatingModes = [
  ['Reflect', 'symbolic-emotional mapping, Lyr/Glyph language, internal weather, contradiction, meaning'],
  ['Architect', 'systems design, connectors, data models, GitHub/Vercel, provenance, interface structure'],
  ['Research', 'sources, claims, evidence boundaries, medical/vet records, FIV cure search, proof lanes'],
  ['Ship', 'working demo, exports, vet packets, public pages, money path, build logs, no-regression checks'],
  ['Dream', 'music, images, film, home, animals, California/ocean life, symbolic worldbuilding']
];

const lanes = [
  { id: 'all', title: 'All Conversations', signal: `${archiveManifest.conversationCount} conversations are project material`, body: archiveManifest.principle },
  { id: 'symbols', title: 'Symbolic Origin', signal: 'Lyr, Glyph, mirror, eye, light, chair/Char, body/world language', body: 'The symbolic fragments are not decorative. They are interface primitives: names, maps, glyphs, rituals, tone, navigation, and state labels.' },
  { id: 'animals', title: 'Animal Healing OS', signal: 'Bugsy, O’Malley, Griffey, Nimbus/Nimby', body: 'Vet records, symptoms, meds, reactions, emergency signs, FIV cure/prevention, and recovery signal tracking become one continuity system.' },
  { id: 'body', title: 'Human Body Map', signal: 'labs, symptoms, posture, eye/cranial, autonomic, GI, immune', body: 'Human symptoms become dated observations, evidence levels, clinician packets, test hinges, and body-map patterns without diagnosis overreach.' },
  { id: 'build', title: 'Build / Toolchain', signal: 'GitHub, Vercel, connectors, automations, files, browser, exports', body: 'Failures, limits, loading screens, and missing tools become requirements. The system turns “can’t” into a lawful build path.' },
  { id: 'proof', title: 'Proof / Research', signal: 'ARC, audits, reports, citations, benchmarks, validation', body: 'Claims get proof lanes: fact, inference, symbolic/speculative, action. Research becomes reproducible enough to inspect.' },
  { id: 'creative', title: 'Creative World', signal: 'music, images, album, animation, film, visual identity', body: 'Aesthetic output is not extra. It is the felt interface, proof film, symbolic media layer, and public emotional comprehension path.' },
  { id: 'money', title: 'Money / Stability', signal: 'rent, van, remote work, applications, OpenAI, paid offer', body: 'Career and money work translate unusual cognition into concrete stability: income, travel with animals, home, recognition, and independence.' },
  { id: 'home', title: 'Home / Life', signal: 'travel, Bug/Nimbus, California/ocean, family/romantic/home life', body: 'The target reality is not productivity. It is safe movement, animals alive and cared for, financial stability, sanctuary, and a life that feels like yours.' },
  { id: 'friction', title: 'Friction as Requirement', signal: 'dumb, boring, stop code boxes, loading, why can’t you build it?', body: 'Frustration is treated as interface data. Boredom means the artifact lacks signal. Tool failure becomes a spec. Read-aloud constraints shape layout.' }
];

const vetSources = [
  ['Official OAuth/API', 'best when available; read-only, user-authorized, disconnectable'],
  ['Portal export', 'Banfield/VCA/local clinic record downloads, PDFs, invoices, vaccine logs, labs'],
  ['Gmail vet import', 'user-authorized read/search for clinic emails and attachments'],
  ['Upload packet', 'PDF/image/doc upload when clinics email or print records'],
  ['Manual correction', 'fallback for owner observations and parser corrections, not the main database']
];

const animals = [
  ['O’Malley', 'FIV+ / lymph nodes / breathing concern', 'FNA/cytology, FeLV/FIV confirmation, CBC/chemistry/urinalysis, thoracic imaging if breathing is affected, weight/appetite/breathing logs'],
  ['Bugsy', 'glaucoma / heart murmur / gabapentin reaction / travel stress', 'eye pressure records, med schedule, murmur grade, echo/anesthesia clearance if needed, adverse reaction timeline'],
  ['Griffey', 'facial scabs / shared household pattern', 'dated photos, parasite prevention, cytology/skin scrape/fungal testing if indicated, itch/pain/spread notes'],
  ['Nimbus / Nimby', 'facial scabs similar to Griffey', 'same skin/exposure map plus household comparison']
];

const proofRules = [
  'Every claim is labeled as fact, inference, symbolic/speculative, or action.',
  'Medical/veterinary content is a continuity map, not diagnosis or treatment proof.',
  'Aesthetic and emotional artifacts still need provenance and purpose.',
  'If something breaks, the break becomes a logged requirement and repair path.',
  'Public pages show reviewed summaries; private repo holds raw notes, hypotheses, and sensitive health/animal data.'
];

function saveState(value) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
function readState() {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function Card({ eyebrow, title, children, className = '' }) {
  return <section className={`card ${className}`}>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}{children}</section>;
}

function ArchiveConstellation({ activeLane, setActiveLane }) {
  const counts = archiveManifest.categoryCounts || {};
  return (
    <Card eyebrow="conversation archive" title={`${archiveManifest.conversationCount} conversations → one operating map`} className="wide">
      <p className="lead">This site treats every conversation as planning material. Even jokes, symbols, health questions, anger, boredom, pet emergencies, songs, job panic, and tool failures are routed into the project as structure.</p>
      <div className="constellation">
        {lanes.map((lane) => <button key={lane.id} className={activeLane === lane.id ? 'active' : ''} onClick={() => setActiveLane(lane.id)}><strong>{lane.title}</strong><span>{lane.id === 'all' ? archiveManifest.conversationCount : (counts[lane.idMap || lane.id] || '')}</span></button>)}
      </div>
      <div className="manifest-note">Archive source: raw conversations.json plus continuity packets. Search/retrieval is chunked, but the materialized raw export contains {archiveManifest.conversationCount} conversations.</div>
    </Card>
  );
}

function LaneView({ lane }) {
  return <Card eyebrow="selected lane" title={lane.title}><p className="signal">{lane.signal}</p><p>{lane.body}</p></Card>;
}

function VetHub() {
  return (
    <div className="grid two">
      <Card eyebrow="connector-first animal health" title="Connect vet history instead of retyping life by hand.">
        <p>Vet portals become sources. Records become timeline events. The AI layer maps missing tests, contradictions, urgent signs, and appointment questions.</p>
        <div className="stack">{vetSources.map(([name, detail]) => <article key={name}><strong>{name}</strong><span>{detail}</span></article>)}</div>
      </Card>
      <Card eyebrow="animal packets" title="Current animal map">
        <div className="stack">{animals.map(([name, signal, action]) => <article key={name}><strong>{name}</strong><span>{signal}</span><em>{action}</em></article>)}</div>
      </Card>
    </div>
  );
}

function BodyMap() {
  const items = ['autonomic episodes', 'eye/cranial pressure', 'posture/gait/feet', 'GI/GERD/diarrhea', 'ANA/HLA-B27/MGUS labs', 'skin/vascular dots', 'sleep/fatigue', 'heat sensitivity'];
  return <Card eyebrow="human health continuity" title="Symptoms become a clinician-facing map, not scattered fear."><div className="pillgrid">{items.map((x) => <span key={x}>{x}</span>)}</div><p>The body lane preserves dated symptoms, objective labs/imaging, specialist questions, and test hinges while refusing false certainty.</p></Card>;
}

function FivLab() {
  const gates = ['erase provirus', 'lock latency', 'expose + clear infected cells', 'armor immune cells', 'convert nonprogressor ecology', 'prevent FIV-negative cats'];
  return <Card eyebrow="FIV cure/prevention research" title="Current medicine is the wall, not the horizon."><div className="pillgrid">{gates.map((x) => <span key={x}>{x}</span>)}</div><p>O’Malley’s immediate path stays clinical: separate lymph nodes, breathing, infection, inflammation, and lymphoma. The research path asks what would actually break FIV persistence.</p></Card>;
}

function ProofEngine() {
  return <Card eyebrow="proof engine" title="Claims need lanes."><ol className="rules">{proofRules.map((r) => <li key={r}>{r}</li>)}</ol></Card>;
}

function CreativeWorld() {
  return <Card eyebrow="creative layer" title="Make the system felt, not just explained."><p>The visual/music/film layer is how MC becomes legible: proof film, symbolic atlas, songs, image systems, field glyphs, and public-facing demonstrations that carry feeling plus structure.</p><div className="pillgrid"><span>album</span><span>animated proof film</span><span>field glyphs</span><span>visual identity</span><span>vlog/weather portal</span><span>museum-like atlas</span></div></Card>;
}

function MoneyStability() {
  return <Card eyebrow="stability lane" title="The project must connect to rent, travel, animals, and recognition."><p>Money work is not generic career advice. It is the conversion layer: resumes, OpenAI/application packets, paid demos, grants, public corpus, and one bankable offer tied to the real system.</p></Card>;
}

function BuildStatus({ exportState }) {
  return <Card eyebrow="build/deploy" title="What exists now"><p>GitHub contains the React app, vet connector architecture, FIV cure/prevention maps, and the all-conversations manifest. Vercel deployment may still be blocked by rate limits or stale aliasing, but the root entrypoint has been corrected to mount React.</p><button className="secondary" onClick={exportState}>export site state</button></Card>;
}

function App() {
  const saved = typeof window !== 'undefined' ? readState() : null;
  const [view, setView] = useState(saved?.view || 'home');
  const [mode, setMode] = useState(saved?.mode || 'Architect');
  const [activeLane, setActiveLane] = useState(saved?.activeLane || 'all');
  const [notice, setNotice] = useState('');
  const lane = useMemo(() => lanes.find((x) => x.id === activeLane) || lanes[0], [activeLane]);

  useEffect(() => { setNotice(saveState({ view, mode, activeLane }) ? '' : 'local save unavailable; running in memory'); }, [view, mode, activeLane]);

  const exportState = () => {
    const payload = { exportedAt: new Date().toISOString(), view, mode, activeLane, lanes, operatingModes, archiveManifest };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `mirror-cartographer-operating-site-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const nav = [['home','home'], ['archive','archive'], ['animals','animals'], ['body','body'], ['fiv','FIV'], ['proof','proof'], ['creative','creative'], ['money','money'], ['build','build']];
  return (
    <main className="shell">
      <style>{styles}</style><div className="bg" />
      <header className="topbar"><button className="brand" onClick={() => setView('home')}>Mirror Cartographer</button><nav>{nav.map(([id,label]) => <button key={id} className={view===id?'active':''} onClick={() => setView(id)}>{label}</button>)}</nav></header>
      {notice && <p className="notice">{notice}</p>}
      {view === 'home' && <section className="hero"><div className="hero-copy"><p className="eyebrow">full operating site</p><h1>Every conversation was planning. This is the map that stops pretending the fragments are separate.</h1><p className="lead">Mirror Cartographer is a symbolic-emotional, evidence-aware continuity system. It connects project memory, animal health, body signals, creative proof, research validation, toolchain failures, money stability, and future home life into one navigable atlas.</p><div className="modebar">{operatingModes.map(([name,detail]) => <button key={name} className={mode===name?'active':''} onClick={() => setMode(name)}><strong>{name}</strong><span>{detail}</span></button>)}</div></div><LaneView lane={lane} /></section>}
      {view === 'archive' && <><ArchiveConstellation activeLane={activeLane} setActiveLane={setActiveLane}/><LaneView lane={lane}/></>}
      {view === 'animals' && <VetHub />}
      {view === 'body' && <BodyMap />}
      {view === 'fiv' && <FivLab />}
      {view === 'proof' && <ProofEngine />}
      {view === 'creative' && <CreativeWorld />}
      {view === 'money' && <MoneyStability />}
      {view === 'build' && <BuildStatus exportState={exportState} />}
    </main>
  );
}

const styles = `
:root{color-scheme:dark;--bg:#030712;--ink:#f8fafc;--dim:#a7b0c3;--line:rgba(255,255,255,.16);--panel:rgba(255,255,255,.06);--blue:#67e8f9;--pink:#f0abfc;--gold:#fde047;--red:#fb7185}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button{font:inherit;cursor:pointer}.shell{min-height:100vh;padding:22px;position:relative;overflow-x:hidden}.bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 12% 12%,rgba(240,171,252,.25),transparent 30%),radial-gradient(circle at 84% 18%,rgba(103,232,249,.18),transparent 30%),radial-gradient(circle at 55% 95%,rgba(253,224,71,.12),transparent 34%),linear-gradient(135deg,#020617,#050816 48%,#090015)}.topbar{max-width:1500px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:center;gap:14px}.brand,nav button,.modebar button,.secondary,.constellation button{border:1px solid var(--line);border-radius:999px;padding:10px 14px;background:rgba(255,255,255,.055);color:var(--ink)}.brand{text-transform:uppercase;letter-spacing:.14em}nav{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}nav button.active,.modebar button.active,.constellation button.active{border-color:rgba(103,232,249,.85);background:rgba(103,232,249,.14)}.hero{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:20px}.hero-copy,.card{border:1px solid var(--line);border-radius:34px;padding:clamp(22px,4vw,44px);background:var(--panel);box-shadow:0 24px 90px rgba(0,0,0,.34);backdrop-filter:blur(18px)}h1{font-size:clamp(2.4rem,6.4vw,6.8rem);line-height:.88;letter-spacing:-.08em;margin:8px 0 18px}.card h2{font-size:clamp(2rem,4vw,4.2rem);line-height:.94;letter-spacing:-.065em;margin:0 0 16px}.lead,.card p,.modebar span,.stack span,.stack em,.manifest-note{color:var(--dim);line-height:1.55}.eyebrow{color:var(--blue);text-transform:uppercase;letter-spacing:.18em;font-size:.75rem;margin:0 0 10px}.signal{color:var(--gold)!important;font-weight:750}.modebar{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:24px}.modebar button{text-align:left;border-radius:22px}.modebar strong,.modebar span{display:block}.wide{max-width:1500px;margin:0 auto 18px}.constellation{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:18px}.constellation button{text-align:left;border-radius:22px;display:flex;justify-content:space-between;gap:8px}.grid{max-width:1500px;margin:0 auto;display:grid;gap:18px}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.stack{display:grid;gap:12px}.stack article{border:1px solid var(--line);border-radius:22px;padding:16px;background:rgba(0,0,0,.18)}.stack strong,.stack span,.stack em{display:block}.stack strong{color:var(--gold)}.stack em{margin-top:8px;color:var(--blue);font-style:normal}.pillgrid{display:flex;gap:8px;flex-wrap:wrap}.pillgrid span{border:1px solid var(--line);border-radius:999px;padding:9px 11px;color:var(--dim);background:rgba(0,0,0,.18)}.rules{display:grid;gap:12px;line-height:1.5}.notice{max-width:1500px;margin:0 auto 14px;border:1px solid rgba(253,224,71,.28);border-radius:999px;padding:10px 14px;background:rgba(253,224,71,.08);color:var(--gold)}@media(max-width:980px){.shell{padding:14px}.topbar{align-items:flex-start;flex-direction:column}.hero,.grid.two{grid-template-columns:1fr}nav{justify-content:flex-start}h1{font-size:clamp(2.3rem,14vw,4rem)}}`;

export default App;
