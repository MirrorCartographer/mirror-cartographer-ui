import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mirror.cartographer.vet.atlas.v3';

const defaultPets = [
  {
    id: 'omalley',
    name: "O'Malley",
    species: 'cat',
    signal: 'FIV+ / enlarged lymph nodes / breathing concern',
    priority: 'diagnostic separation: FIV baseline vs lymphoma vs infection vs inflammation vs compression',
  },
  {
    id: 'bugsy',
    name: 'Bugsy',
    species: 'dog',
    signal: 'glaucoma / heart murmur / medication sensitivity / travel stress',
    priority: 'unify ophthalmology, cardiology, medication reactions, and symptom timing',
  },
  {
    id: 'griffey-nimbus',
    name: 'Griffey + Nimbus',
    species: 'cats',
    signal: 'skin / facial scabs / household exposure pattern',
    priority: 'separate fleas, mites, infection, allergy, stress, and immune-status effects',
  },
];

const vetPortals = [
  {
    id: 'banfield',
    name: 'Banfield / PetWare style portal',
    status: 'connector target',
    bestPath: 'official account export, records PDF, vaccine/visit summaries, invoice PDFs, medication history',
    blocker: 'needs authorized portal/API/export access; do not scrape passwords',
  },
  {
    id: 'vca',
    name: 'VCA / hospital visit records',
    status: 'connector target',
    bestPath: 'visit summaries, discharge instructions, invoices, medication list, lab attachments, email records',
    blocker: 'needs user-authorized record export or email/document ingestion',
  },
  {
    id: 'south-rowan',
    name: 'Local/private veterinary clinics',
    status: 'document/email import first',
    bestPath: 'request complete medical record PDF and lab attachments by email; ingest into timeline',
    blocker: 'many small clinics lack public APIs',
  },
  {
    id: 'specialists',
    name: 'Eye/cardiology/specialty clinics',
    status: 'high-value ingestion',
    bestPath: 'ophthalmology pressure logs, glaucoma medication changes, echocardiogram reports, anesthesia clearance notes',
    blocker: 'must preserve exact dates, values, dose changes, and clinician notes',
  },
];

const connectorStages = [
  {
    title: '1. Authorize source',
    detail: 'Use OAuth/API if a vet hub supports it. If not, use a user-approved export, emailed record packet, or uploaded PDF. No credential scraping.',
  },
  {
    title: '2. Pull raw records',
    detail: 'Collect visits, labs, diagnoses, meds, vaccines, imaging reports, invoices, discharge notes, attachments, and clinician instructions.',
  },
  {
    title: '3. Normalize timeline',
    detail: 'Convert every item into date, pet, clinic, source, category, observation, value, unit, interpretation, confidence, and next-action fields.',
  },
  {
    title: '4. Detect conflicts',
    detail: 'Flag missing labs, contradictory diagnoses, dose changes without dates, unexplained symptoms, and repeated visits with no closed loop.',
  },
  {
    title: '5. Map action hinges',
    detail: 'Turn history into specific next tests, questions for the vet, monitoring logs, and research paths. Keep evidence separate from hypotheses.',
  },
];

const timelineSchema = [
  'pet_id', 'event_date', 'source_clinic', 'record_type', 'problem', 'observation', 'test_or_procedure', 'result_value', 'unit', 'medication', 'dose', 'frequency', 'clinician_assessment', 'owner_observation', 'confidence', 'next_action', 'source_attachment'
];

const fivGates = [
  ['Erase', 'Disable integrated FIV provirus with multiplex gene-editing logic; proof requires no replication-competent rebound.'],
  ['Lock', 'Silence viral transcription permanently enough that provirus cannot reactivate under inflammatory stress.'],
  ['Expose + clear', 'Wake hidden infected cells only if paired with safe immune clearance.'],
  ['Armor', 'Make immune cells resistant to FIV entry/replication without damaging normal CD134/CXCR4 function.'],
  ['Convert ecology', 'Find nonprogressor patterns and reduce inflammatory terrain that lets FIV cause damage.'],
  ['Prevent', 'For FIV-negative cats: testing, bite prevention, indoor exposure control, and vaccine decisions only when available and justified.'],
];

const sampleEvents = [
  { pet: "O'Malley", date: 'unknown', type: 'diagnosis', text: 'FIV-positive. Multiple enlarged lymph nodes reported. Breathing may be affected.', action: 'Vet lymph-node map, FNA/cytology, CBC/chemistry/urinalysis, FeLV status, thoracic imaging if breathing concern is real.' },
  { pet: 'Bugsy', date: 'travel episode', type: 'reaction', text: 'Gabapentin doses followed by pacing/spinning/restlessness and vomiting; murmur and glaucoma history present.', action: 'Preserve dose/timing, flag as medication sensitivity, coordinate sedation/anesthesia decisions with cardiology/ophthalmology risk.' },
  { pet: 'Griffey + Nimbus', date: 'household pattern', type: 'skin', text: 'Facial scabs in multiple cats suggest exposure/allergy/stress/infection differential.', action: 'Flea control history, cytology/skin scrape if lesions persist, household map, O’Malley immune-status separation.' },
];

function readState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function ShellCard({ eyebrow, title, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

function ConnectorConsole({ selectedPortal, setSelectedPortal, setView }) {
  const portal = vetPortals.find((item) => item.id === selectedPortal) || vetPortals[0];
  return (
    <div className="connector-console">
      <ShellCard eyebrow="connector-first design" title="Connect vet portals without turning the owner into the database.">
        <p className="lead">The site should prefer authorized record ingestion over manual entry. Manual notes stay as fallback and correction layer, not the main workflow.</p>
        <div className="connector-actions">
          <button className="primary" onClick={() => setView('vet-hub')}>open vet hub</button>
          <button className="secondary" onClick={() => setView('records')}>show timeline model</button>
        </div>
      </ShellCard>
      <ShellCard eyebrow="selected source" title={portal.name}>
        <p><strong>Status:</strong> {portal.status}</p>
        <p><strong>Best path:</strong> {portal.bestPath}</p>
        <p><strong>Boundary:</strong> {portal.blocker}</p>
        <div className="portal-buttons">
          {vetPortals.map((item) => (
            <button key={item.id} className={item.id === selectedPortal ? 'active' : ''} onClick={() => setSelectedPortal(item.id)}>{item.name}</button>
          ))}
        </div>
      </ShellCard>
    </div>
  );
}

function AnimalHealth() {
  return (
    <div className="grid three">
      {defaultPets.map((pet) => (
        <ShellCard key={pet.id} eyebrow={pet.species} title={pet.name}>
          <p>{pet.signal}</p>
          <strong>{pet.priority}</strong>
        </ShellCard>
      ))}
    </div>
  );
}

function VetHub({ selectedPortal, setSelectedPortal }) {
  const portal = vetPortals.find((item) => item.id === selectedPortal) || vetPortals[0];
  return (
    <div className="grid two">
      <ShellCard eyebrow="vet hub connector" title="Preferred ingestion path">
        <ol className="steps">
          {connectorStages.map((stage) => (
            <li key={stage.title}><strong>{stage.title}</strong><span>{stage.detail}</span></li>
          ))}
        </ol>
      </ShellCard>
      <ShellCard eyebrow="portal target" title={portal.name}>
        <p>{portal.bestPath}</p>
        <p className="warning">Connector rule: use official APIs/OAuth, user-approved exports, email import, or uploaded files. Do not ask the website to store vet portal passwords or scrape around access controls.</p>
        <div className="portal-buttons tall">
          {vetPortals.map((item) => <button key={item.id} className={item.id === selectedPortal ? 'active' : ''} onClick={() => setSelectedPortal(item.id)}>{item.name}</button>)}
        </div>
      </ShellCard>
    </div>
  );
}

function Records() {
  return (
    <div className="grid two">
      <ShellCard eyebrow="normalized medical timeline" title="Every imported record becomes a structured event.">
        <div className="schema-list">
          {timelineSchema.map((field) => <span key={field}>{field}</span>)}
        </div>
      </ShellCard>
      <ShellCard eyebrow="current known events" title="Seed timeline from conversation memory">
        <div className="timeline">
          {sampleEvents.map((event) => (
            <article key={`${event.pet}-${event.type}`}>
              <span>{event.pet} · {event.date} · {event.type}</span>
              <p>{event.text}</p>
              <strong>{event.action}</strong>
            </article>
          ))}
        </div>
      </ShellCard>
    </div>
  );
}

function FivCure() {
  return (
    <div className="grid three">
      {fivGates.map(([gate, detail]) => (
        <ShellCard key={gate} eyebrow="FIV gate" title={gate}>
          <p>{detail}</p>
        </ShellCard>
      ))}
    </div>
  );
}

function Engine({ exportAtlas }) {
  return (
    <div className="grid two">
      <ShellCard eyebrow="build architecture" title="What the site is supposed to do">
        <p>Mirror Cartographer is the window. GitHub is the provenance engine. Vet records become a normalized timeline. The AI layer maps contradictions, missing tests, disease hypotheses, and next physical hinges.</p>
        <p>The first complete workflow is animal health because it has real stakes, real records, and a clear need for continuity across clinics.</p>
        <button className="secondary" onClick={exportAtlas}>export atlas data</button>
      </ShellCard>
      <ShellCard eyebrow="connector implementation" title="Backend pieces still needed">
        <ol className="steps">
          <li><strong>Auth broker</strong><span>OAuth where supported; otherwise user-approved upload/email connector.</span></li>
          <li><strong>Record parser</strong><span>PDF/email/lab parser that extracts dates, meds, values, diagnoses, and clinician notes.</span></li>
          <li><strong>Private database</strong><span>Per-pet medical timeline with source attachment hashes and correction history.</span></li>
          <li><strong>Vet packet generator</strong><span>Export concise timeline, questions, and red flags for appointments.</span></li>
        </ol>
      </ShellCard>
    </div>
  );
}

function App() {
  const saved = typeof window !== 'undefined' ? readState() : null;
  const [view, setView] = useState(saved?.view || 'atlas');
  const [selectedPortal, setSelectedPortal] = useState(saved?.selectedPortal || 'banfield');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const ok = writeState({ view, selectedPortal });
    setNotice(ok ? '' : 'local save unavailable; site still runs in memory');
  }, [view, selectedPortal]);

  const exportAtlas = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Mirror Cartographer Vet Atlas',
      modules: ['atlas', 'animal-health', 'vet-hub', 'records', 'fiv-cure', 'engine'],
      pets: defaultPets,
      vetPortals,
      connectorStages,
      timelineSchema,
      fivGates,
      sampleEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mirror-cartographer-vet-atlas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const nav = [
    ['atlas', 'atlas'],
    ['animal-health', 'animals'],
    ['vet-hub', 'vet hub'],
    ['records', 'records'],
    ['fiv-cure', 'FIV cure'],
    ['engine', 'engine'],
  ];

  return (
    <main className="shell">
      <style>{styles}</style>
      <div className="background" />
      <header className="topbar">
        <button className="brand" onClick={() => setView('atlas')}>Mirror Cartographer</button>
        <nav>
          {nav.map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>)}
        </nav>
      </header>
      {notice && <p className="notice">{notice}</p>}

      {view === 'atlas' && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">finished direction: vet-connected cognition atlas</p>
            <h1>One place where pet history, vet records, symptoms, research maps, and next actions stop scattering.</h1>
            <p className="lead">The site connects to veterinary record sources when possible, imports documents when APIs do not exist, normalizes the history, then maps what is known, unknown, urgent, testable, and research-facing.</p>
            <div className="actions">
              <button className="primary" onClick={() => setView('vet-hub')}>connect vet history</button>
              <button className="secondary" onClick={() => setView('animal-health')}>open animal map</button>
            </div>
          </div>
          <ConnectorConsole selectedPortal={selectedPortal} setSelectedPortal={setSelectedPortal} setView={setView} />
        </section>
      )}

      {view === 'animal-health' && <AnimalHealth />}
      {view === 'vet-hub' && <VetHub selectedPortal={selectedPortal} setSelectedPortal={setSelectedPortal} />}
      {view === 'records' && <Records />}
      {view === 'fiv-cure' && <FivCure />}
      {view === 'engine' && <Engine exportAtlas={exportAtlas} />}
    </main>
  );
}

const styles = `
  :root { color-scheme: dark; --bg:#030712; --ink:#f8fafc; --dim:#a7b0c3; --muted:#64748b; --line:rgba(255,255,255,.16); --panel:rgba(255,255,255,.06); --blue:#67e8f9; --pink:#f0abfc; --gold:#fde047; --red:#fb7185; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  button, input, textarea { font:inherit; }
  button { cursor:pointer; }
  .shell { min-height:100vh; padding:22px; position:relative; overflow-x:hidden; }
  .background { position:fixed; inset:0; z-index:-1; background: radial-gradient(circle at 12% 12%, rgba(240,171,252,.24), transparent 30%), radial-gradient(circle at 85% 18%, rgba(103,232,249,.16), transparent 30%), radial-gradient(circle at 55% 95%, rgba(253,224,71,.11), transparent 34%), linear-gradient(135deg,#020617,#050816 48%,#090015); }
  .topbar { max-width:1500px; margin:0 auto 24px; display:flex; justify-content:space-between; align-items:center; gap:14px; }
  .brand, nav button, .primary, .secondary, .portal-buttons button { border:1px solid var(--line); border-radius:999px; padding:10px 14px; background:rgba(255,255,255,.055); color:var(--ink); }
  .brand { text-transform:uppercase; letter-spacing:.14em; }
  nav { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  nav button.active, .portal-buttons button.active { border-color:rgba(103,232,249,.8); background:rgba(103,232,249,.14); }
  .primary { border:0; color:#020617; font-weight:850; background:linear-gradient(135deg,var(--pink),var(--blue)); }
  .hero { max-width:1500px; margin:0 auto; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr); gap:20px; align-items:stretch; }
  .hero-copy, .card { border:1px solid var(--line); border-radius:34px; padding:clamp(22px,4vw,44px); background:var(--panel); box-shadow:0 24px 90px rgba(0,0,0,.34); backdrop-filter:blur(18px); }
  .hero h1 { font-size:clamp(2.4rem,6.4vw,6.9rem); line-height:.88; letter-spacing:-.08em; margin:8px 0 18px; }
  .lead, .card p, .steps span, .timeline p { color:var(--dim); line-height:1.55; }
  .eyebrow { color:var(--blue); text-transform:uppercase; letter-spacing:.18em; font-size:.75rem; margin:0 0 10px; }
  .actions, .connector-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:22px; }
  .connector-console { display:grid; gap:18px; }
  .grid { max-width:1500px; margin:0 auto; display:grid; gap:18px; }
  .grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .grid.three { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .card h2 { font-size:clamp(1.9rem,3.8vw,4rem); line-height:.94; letter-spacing:-.065em; margin:0 0 16px; }
  .card strong { color:var(--blue); line-height:1.42; }
  .portal-buttons { display:grid; gap:8px; margin-top:18px; }
  .portal-buttons.tall button { text-align:left; border-radius:18px; }
  .warning { border:1px solid rgba(251,113,133,.35); border-radius:20px; padding:14px; background:rgba(251,113,133,.08); color:#fecdd3 !important; }
  .steps { display:grid; gap:12px; margin:0; padding-left:20px; }
  .steps li { padding-left:8px; }
  .steps strong { display:block; color:var(--gold); margin-bottom:4px; }
  .schema-list { display:flex; gap:8px; flex-wrap:wrap; }
  .schema-list span { border:1px solid var(--line); border-radius:999px; padding:8px 10px; color:var(--dim); background:rgba(0,0,0,.18); }
  .timeline { display:grid; gap:12px; }
  .timeline article { border:1px solid var(--line); border-radius:22px; padding:16px; background:rgba(0,0,0,.18); }
  .timeline span { color:var(--gold); font-size:.78rem; text-transform:uppercase; letter-spacing:.13em; }
  .notice { max-width:1500px; margin:0 auto 14px; border:1px solid rgba(253,224,71,.28); border-radius:999px; padding:10px 14px; background:rgba(253,224,71,.08); color:var(--gold); }
  @media (max-width:980px) { .shell { padding:14px; } .topbar, .hero { grid-template-columns:1fr; flex-direction:column; align-items:flex-start; } .grid.two, .grid.three { grid-template-columns:1fr; } nav { justify-content:flex-start; } }
`;

export default App;
