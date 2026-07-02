import React, { useEffect, useMemo, useState } from 'react';
import archiveManifest from '../data/mcArchiveManifest.json';

const STORAGE_KEY = 'mirror.cartographer.operating.site.v2';

const operatingModes = [
  ['Reflect', 'symbolic-emotional mapping, Lyr/Glyph language, internal weather, contradiction, meaning'],
  ['Architect', 'systems design, connectors, data models, GitHub/Vercel, provenance, interface structure'],
  ['Research', 'sources, claims, evidence boundaries, medical/vet records, FIV cure search, proof lanes'],
  ['Ship', 'working demo, exports, vet packets, public pages, money path, build logs, no-regression checks'],
  ['Dream', 'music, images, film, home, animals, California/ocean life, symbolic worldbuilding']
];

const categoryKey = {
  symbols: 'symbolic-origin',
  animals: 'animal-healing',
  body: 'human-body',
  build: 'mc-build',
  proof: 'proof-research',
  creative: 'creative-world',
  money: 'money-stability',
  home: 'home-life',
  friction: 'friction-as-requirement'
};

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

const synthesisPrompts = [
  ['What happened?', 'observable scene, quote, symptom, page failure, animal behavior, body sensation'],
  ['What did it feel like?', 'image, color, pressure, motion, weather, music, atmosphere'],
  ['What could it mean?', 'symbolic hypothesis, system requirement, contradiction, research question'],
  ['What would prove or disprove it?', 'source, test, measurement, vet/medical record, build artifact, repeat observation'],
  ['What should ship next?', 'interface, packet, report, page, automation, public proof, private log']
];

const nextNodes = [
  ['Field Intake', 'capture symbols, body signals, animal observations, friction, and sensory weather'],
  ['Evidence Gate', 'separate fact, inference, action, and mythic-symbolic language before output'],
  ['Continuity Graph', 'connect repeated symbols and symptoms across conversations without flattening them'],
  ['Artifact Forge', 'turn mapped material into pages, packets, reports, resumes, demos, film, and proof objects'],
  ['Public / Private Split', 'publish legible summaries while keeping raw health and personal records protected']
];

function saveState(value) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
function readState() {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function classifyText(text) {
  const t = text.toLowerCase();
  const hits = lanes.slice(1).map((lane) => {
    const terms = `${lane.title} ${lane.signal} ${lane.body}`.toLowerCase().split(/[^a-z0-9’]+/).filter((x) => x.length > 3);
    const score = terms.reduce((sum, term) => sum + (t.includes(term) ? 1 : 0), 0);
    return { ...lane, score };
  }).sort((a, b) => b.score - a.score);
  return hits[0]?.score ? hits.slice(0, 3) : [lanes[1], lanes[4], lanes[5]];
}

function Card({ eyebrow, title, children, className = '' }) {
  return <section className={`card ${className}`}>{eyebrow && <p className="eyebrow">{eyebrow}</p>}{title && <h2>{title}</h2>}{children}</section>;
}

function GlyphSystem({ activeLane }) {
  const laneIndex = Math.max(0, lanes.findIndex((lane) => lane.id === activeLane));
  return (
    <div className="glyph-system" aria-label="Mirror Cartographer symbolic scientific integration diagram">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit orbit-three" />
      <div className="glyph-core"><span>MC</span><small>{lanes[laneIndex]?.title || 'Atlas'}</small></div>
      {lanes.slice(1, 9).map((lane, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const x = 50 + Math.cos(angle) * 42;
        const y = 50 + Math.sin(angle) * 42;
        return <button key={lane.id} className={`glyph-node ${activeLane === lane.id ? 'active' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} title={lane.title}>{lane.title.split(' ')[0]}</button>;
      })}
    </div>
  );
}

function ArchiveConstellation({ activeLane, setActiveLane }) {
  const counts = archiveManifest.categoryCounts || {};
  return (
    <Card eyebrow="conversation archive" title={`${archiveManifest.conversationCount} conversations → one operating map`} className="wide">
      <p className="lead">This site treats every conversation as planning material. Even jokes, symbols, health questions, anger, boredom, pet emergencies, songs, job panic, and tool failures are routed into the project as structure.</p>
      <div className="constellation">
        {lanes.map((lane) => <button key={lane.id} className={activeLane === lane.id ? 'active' : ''} onClick={() => setActiveLane(lane.id)}><strong>{lane.title}</strong><span>{lane.id === 'all' ? archiveManifest.conversationCount : (counts[categoryKey[lane.id]] || '')}</span></button>)}
      </div>
      <div className="manifest-note">Archive source: raw conversations.json plus continuity packets. Search/retrieval is chunked, but the materialized raw export contains {archiveManifest.conversationCount} conversations.</div>
    </Card>
  );
}

function LaneView({ lane }) {
  return <Card eyebrow="selected lane" title={lane.title}><p className="signal">{lane.signal}</p><p>{lane.body}</p></Card>;
}

function SynthesisLab({ activeLane, setActiveLane }) {
  const [entry, setEntry] = useState('The eye and light keep returning. Chair became Char. Bugsy is the guardian signal. The website should work on any device.');
  const matches = useMemo(() => classifyText(entry), [entry]);
  const primary = matches[0];
  const evidence = entry.trim().length > 80 ? 'inference-ready map node' : 'seed fragment';
  return (
    <section className="lab-layout">
      <Card eyebrow="next integration" title="Synthesis Lab: feeling → symbol → evidence → artifact" className="lab-card">
        <p className="lead">This is the new MC engine layer. It accepts a raw fragment, keeps the emotional-symbolic signal intact, then routes it through scientific proof lanes so the site can generate maps without pretending metaphor is medical fact or that data has no feeling.</p>
        <textarea value={entry} onChange={(event) => setEntry(event.target.value)} aria-label="Synthesis fragment input" />
        <div className="lab-result">
          <strong>{evidence}</strong>
          <span>Primary lane: {primary.title}</span>
          <button onClick={() => setActiveLane(primary.id)}>focus this lane</button>
        </div>
        <div className="stack compact">{synthesisPrompts.map(([name, detail]) => <article key={name}><strong>{name}</strong><span>{detail}</span></article>)}</div>
      </Card>
      <Card eyebrow="live crosswalk" title="Top semantic matches">
        <div className="stack">{matches.map((lane) => <article key={lane.id}><strong>{lane.title}</strong><span>{lane.signal}</span><em>{lane.body}</em></article>)}</div>
      </Card>
      <Card eyebrow="architecture" title="The next five nodes">
        <div className="stack">{nextNodes.map(([name, detail]) => <article key={name}><strong>{name}</strong><span>{detail}</span></article>)}</div>
      </Card>
      <Card eyebrow="visual science" title="Meaning as a navigable morphology">
        <GlyphSystem activeLane={activeLane} />
      </Card>
    </section>
  );
}

function VetHub() {
  return <div className="grid two"><Card eyebrow="connector-first animal health" title="Connect vet history instead of retyping life by hand."><p>Vet portals become sources. Records become timeline events. The AI layer maps missing tests, contradictions, urgent signs, and appointment questions.</p><div className="stack">{vetSources.map(([name, detail]) => <article key={name}><strong>{name}</strong><span>{detail}</span></article>)}</div></Card><Card eyebrow="animal packets" title="Current animal map"><div className="stack">{animals.map(([name, signal, action]) => <article key={name}><strong>{name}</strong><span>{signal}</span><em>{action}</em></article>)}</div></Card></div>;
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
  return <Card eyebrow="build/deploy" title="What exists now"><p>GitHub contains the React app, vet connector architecture, FIV cure/prevention maps, and the all-conversations manifest. This iteration adds the Synthesis Lab: an interactive local-first integration layer for symbolic-scientific routing.</p><button className="secondary" onClick={exportState}>export site state</button></Card>;
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

  const nav = [['home','home'], ['lab','synthesis'], ['archive','archive'], ['animals','animals'], ['body','body'], ['fiv','FIV'], ['proof','proof'], ['creative','creative'], ['money','money'], ['build','build']];
  return (
    <main className="shell">
      <style>{styles}</style><div className="bg" />
      <header className="topbar"><button className="brand" onClick={() => setView('home')}>Mirror Cartographer</button><nav>{nav.map(([id,label]) => <button key={id} className={view===id?'active':''} onClick={() => setView(id)}>{label}</button>)}</nav></header>
      {notice && <p className="notice">{notice}</p>}
      {view === 'home' && <section className="hero"><div className="hero-copy"><p className="eyebrow">full operating site</p><h1>Every conversation was planning. This is the map that stops pretending the fragments are separate.</h1><p className="lead">Mirror Cartographer is a symbolic-emotional, evidence-aware continuity system. It connects project memory, animal health, body signals, creative proof, research validation, toolchain failures, money stability, and future home life into one navigable atlas.</p><div className="modebar">{operatingModes.map(([name,detail]) => <button key={name} className={mode===name?'active':''} onClick={() => setMode(name)}><strong>{name}</strong><span>{detail}</span></button>)}</div></div><div><GlyphSystem activeLane={activeLane}/><LaneView lane={lane} /></div></section>}
      {view === 'lab' && <SynthesisLab activeLane={activeLane} setActiveLane={setActiveLane} />}
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
:root{color-scheme:dark;--bg:#030712;--ink:#f8fafc;--dim:#a7b0c3;--line:rgba(255,255,255,.16);--panel:rgba(255,255,255,.06);--blue:#67e8f9;--pink:#f0abfc;--gold:#fde047;--red:#fb7185;--green:#86efac}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,textarea{font:inherit}button{cursor:pointer}.shell{min-height:100vh;padding:22px;position:relative;overflow-x:hidden}.bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 12% 12%,rgba(240,171,252,.25),transparent 30%),radial-gradient(circle at 84% 18%,rgba(103,232,249,.18),transparent 30%),radial-gradient(circle at 55% 95%,rgba(253,224,71,.12),transparent 34%),linear-gradient(135deg,#020617,#050816 48%,#090015)}.bg:after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(circle at center,black,transparent 78%)}.topbar{max-width:1500px;margin:0 auto 24px;display:flex;justify-content:space-between;align-items:center;gap:14px}.brand,nav button,.modebar button,.secondary,.constellation button,.lab-result button{border:1px solid var(--line);border-radius:999px;padding:10px 14px;background:rgba(255,255,255,.055);color:var(--ink);backdrop-filter:blur(16px)}.brand{font-weight:900;letter-spacing:-.04em}.topbar nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.topbar .active,.modebar .active,.constellation .active,.lab-result button:hover{border-color:rgba(103,232,249,.7);box-shadow:0 0 24px rgba(103,232,249,.18);background:rgba(103,232,249,.12)}.notice{max-width:1500px;margin:0 auto 18px;color:var(--gold)}.hero,.grid,.lab-layout{max-width:1500px;margin:0 auto;display:grid;gap:18px}.hero{grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr);align-items:start}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.lab-layout{grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr)}.lab-card{grid-row:span 2}.card{border:1px solid var(--line);border-radius:34px;padding:24px;background:linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.035));box-shadow:0 24px 90px rgba(0,0,0,.32);backdrop-filter:blur(18px);position:relative;overflow:hidden}.card:before{content:'';position:absolute;inset:-1px;background:radial-gradient(circle at 18% 0,rgba(240,171,252,.16),transparent 26%),radial-gradient(circle at 100% 10%,rgba(103,232,249,.12),transparent 28%);pointer-events:none}.card>*{position:relative}.wide{max-width:1500px;margin:0 auto 18px}.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:.74rem;color:var(--blue);font-weight:900;margin:0 0 10px}h1{font-size:clamp(3rem,8vw,7.6rem);line-height:.82;letter-spacing:-.085em;margin:0 0 18px;text-wrap:balance}h2{font-size:clamp(1.6rem,3vw,3rem);line-height:.94;letter-spacing:-.055em;margin:0 0 14px}p{color:var(--dim);line-height:1.58}.lead{font-size:1.08rem;color:#dbeafe}.signal{color:var(--gold);font-weight:800}.modebar,.pillgrid,.constellation{display:grid;gap:10px}.modebar{grid-template-columns:repeat(5,minmax(0,1fr));margin-top:22px}.modebar button{text-align:left;border-radius:22px;padding:14px}.modebar strong,.modebar span,.constellation strong,.constellation span{display:block}.modebar span,.constellation span,.stack span,.stack em{color:var(--dim);font-size:.9rem;font-style:normal;line-height:1.35}.constellation{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-top:18px}.constellation button{text-align:left;border-radius:22px}.manifest-note{margin-top:16px;color:#cbd5e1;font-size:.9rem}.stack{display:grid;gap:10px}.stack article{border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:13px;background:rgba(255,255,255,.04)}.stack.compact article{padding:11px}.stack strong,.stack span,.stack em{display:block}.stack strong{margin-bottom:4px}.pillgrid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:18px 0}.pillgrid span{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:10px 12px;background:rgba(255,255,255,.045);color:#e0f2fe}.rules{display:grid;gap:12px;padding-left:22px;color:#dbeafe}.secondary{margin-top:12px}textarea{width:100%;min-height:180px;border:1px solid rgba(255,255,255,.16);border-radius:24px;padding:18px;background:rgba(2,6,23,.7);color:var(--ink);resize:vertical;outline:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}textarea:focus{border-color:rgba(240,171,252,.65);box-shadow:0 0 0 4px rgba(240,171,252,.08)}.lab-result{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 18px;padding:12px;border-radius:22px;background:rgba(103,232,249,.09);border:1px solid rgba(103,232,249,.2)}.lab-result strong{color:var(--green)}.lab-result span{color:#dbeafe}.glyph-system{height:430px;position:relative;border:1px solid rgba(255,255,255,.13);border-radius:32px;overflow:hidden;background:radial-gradient(circle at center,rgba(103,232,249,.13),transparent 28%),radial-gradient(circle at 20% 20%,rgba(240,171,252,.12),transparent 30%),rgba(255,255,255,.035)}.orbit{position:absolute;inset:14%;border:1px solid rgba(255,255,255,.18);border-radius:50%;animation:spin 28s linear infinite}.orbit-two{inset:24%;border-color:rgba(253,224,71,.25);animation-duration:18s;animation-direction:reverse}.orbit-three{inset:34%;border-color:rgba(240,171,252,.22);animation-duration:40s}.glyph-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:142px;height:142px;border-radius:50%;display:grid;place-items:center;text-align:center;border:1px solid rgba(255,255,255,.24);background:rgba(2,6,23,.82);box-shadow:0 0 70px rgba(103,232,249,.18)}.glyph-core span{font-size:2.7rem;font-weight:950;letter-spacing:-.08em}.glyph-core small{display:block;color:var(--dim);max-width:100px}.glyph-node{position:absolute;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 10px;background:rgba(255,255,255,.08);color:#f8fafc;box-shadow:0 10px 30px rgba(0,0,0,.25)}.glyph-node.active{border-color:var(--gold);background:rgba(253,224,71,.14);color:#fef9c3}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:950px){.hero,.grid.two,.lab-layout{grid-template-columns:1fr}.modebar{grid-template-columns:1fr}.topbar{align-items:flex-start;flex-direction:column}.topbar nav{justify-content:flex-start}.shell{padding:14px}h1{font-size:clamp(2.7rem,18vw,5rem)}.glyph-system{height:360px}.card{border-radius:26px;padding:18px}}@media(prefers-reduced-motion:reduce){.orbit{animation:none}}
`;

export default App;
