import React, { useEffect, useMemo, useRef, useState } from 'react';
import SkyWorld from './App';
import LivingCountry from './LivingCountry';
import { infrastructure } from '../services/infrastructure';
import './OperatingAtlas.css';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const FEATURES = [
  ['atlas','Operating atlas','Follow the threads between experiences, ideas, evidence, and the work they become.'],
  ['country','The Living Country','An interactive, hand-marked field atlas: fragments, context shifts, investigation, and a clear way back to grounded care.'],
  ['archive','Conversation archive','Find the fragments that return, change, contradict one another, or reveal a thread across time.'],
  ['accounts','Identity and accounts','Local profile plus provider-ready account boundary.'],
  ['memory','Persistent memory','Local-first saved state with export and reset.'],
  ['sessions','Session modes','One-off, persistent, ritual, facilitated, and group modes.'],
  ['tone','Tone modes','Symbolic, neutral, scientific, and adaptive interpretation.'],
  ['symbols','Symbol engine','Give an experience a shape, explore what it might mean, and keep its interpretation revisable.'],
  ['body','Body map','Spatial symptom marking with intensity and notes.'],
  ['health','Human health lane','Symptoms, tests, medications, and clinician questions.'],
  ['animals','Animal health lane','Pet profiles, events, medication reactions, and signals.'],
  ['vet','Veterinary connector','Provider-safe connector architecture and source tracking.'],
  ['vet-import','Vet record import','Reviewable local file metadata and timeline extraction queue.'],
  ['fiv','FIV research lane','Evidence-aware research claims and unknowns.'],
  ['proof','Evidence graph','Keep observation, inference, symbol, hypothesis, and action distinct while showing where they meet.'],
  ['judgment','Human Judgment Lab','Test how evidence, shared bias, panel size, and uncertainty affect agreement and accuracy.'],
  ['concepts','Concept graph','Follow relationships across domains without mistaking resemblance for proof.'],
  ['decisions','Decision log','Record, supersede, and trace consequential decisions.'],
  ['projects','Project graph','Trace how projects and ideas evolve, what they depend on, and what they leave unresolved.'],
  ['creative','Creative world','A wordless audiovisual world where movement, light, and sound give form to an encounter.'],
  ['access','Accessibility','Text mode, contrast, motion, scale, and keyboard support.'],
  ['crisis','Crisis override','Switch immediately to direct, concrete, safety-first language.'],
  ['privacy','Privacy controls','Per-item public/private/sensitive classification.'],
  ['imports','Data import center','Queue conversations, notes, records, images, and research.'],
  ['artifacts','Artifact library','Versioned packets, maps, reports, and exports.'],
  ['demos','Public demo packets','Generate public-safe continuity packet previews.'],
  ['offers','Paid offers','Operational service pages and request intake.'],
  ['support','Payments and support','Configurable payment, sponsorship, and barter links.'],
  ['money','Money and stability','Needs, offers, expected value, and stability gap.'],
  ['film','Proof film','Storyboard and production tracker for a visual proof demo.'],
  ['offline','Standalone fallback','Installable offline shell and data export.'],
  ['public','Public-safe cleanup','Redaction checklist and publication readiness.'],
  ['arc','ARC lab','Solver expansion tracker and benchmark record.'],
];

const seed = {
  profile: { name: '', mode: 'persistent', tone: 'adaptive' },
  archive: [], symbols: [], bodyMarks: [], health: [], animals: [], vetSources: [], research: [], evidence: [], concepts: [], decisions: [], projects: [],
  imports: [], artifacts: [], offers: [], support: [], money: [], film: [], arc: [],
  privacy: { default: 'private', publicSafe: true },
  accessibility: { textMode: false, highContrast: false, reducedMotion: false, scale: 1 },
};

function useAtlasState() {
  const [state, setState] = useState(() => read('mc-atlas-v1', seed));
  useEffect(() => write('mc-atlas-v1', state), [state]);
  const patch = (key, value) => setState((s) => ({ ...s, [key]: typeof value === 'function' ? value(s[key]) : value }));
  const add = (key, item) => patch(key, (items = []) => [{ id: uid(), created: today(), privacy: state.privacy.default, ...item }, ...items]);
  const remove = (key, id) => patch(key, (items = []) => items.filter((item) => item.id !== id));
  return { state, setState, patch, add, remove };
}

function Form({ fields, submitLabel = 'Add', onSubmit }) {
  const [value, setValue] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.default || ''])));
  const [notice, setNotice] = useState('');
  return <form className="atlas-form" onSubmit={(e) => { e.preventDefault(); try { onSubmit(value); setValue(Object.fromEntries(fields.map((f) => [f.name, f.default || '']))); setNotice('Saved to this browser.'); } catch (error) { setNotice(error?.message || 'Could not save this entry.'); } }}>
    {fields.map((field) => field.type === 'select'
      ? <label className="atlas-field" key={field.name}><span>{field.label}</span><select required={field.required !== false} aria-label={field.label} value={value[field.name]} onChange={(e) => setValue({ ...value, [field.name]: e.target.value })}>{field.options.map((o) => <option key={o}>{o}</option>)}</select></label>
      : field.type === 'textarea'
        ? <label className="atlas-field" key={field.name}><span>{field.label}</span><textarea required={field.required !== false} aria-label={field.label} placeholder={field.placeholder || field.label} value={value[field.name]} onChange={(e) => setValue({ ...value, [field.name]: e.target.value })} /></label>
        : <label className="atlas-field" key={field.name}><span>{field.label}</span><input required={field.required !== false} min={field.min} max={field.max} step={field.step || (field.type === 'number' ? 'any' : undefined)} type={field.type || 'text'} placeholder={field.placeholder || field.label} value={value[field.name]} onChange={(e) => setValue({ ...value, [field.name]: e.target.value })} /></label>)}
    <button type="submit">{submitLabel}</button><small className="form-status" role="status">{notice}</small>
  </form>;
}

function List({ items = [], onRemove, render }) {
  if (!items.length) return <p className="empty">Nothing recorded yet.</p>;
  return <div className="atlas-list">{items.map((item) => <article key={item.id} className="list-card">{render(item)}<button className="quiet" onClick={() => onRemove(item.id)}>Remove</button></article>)}</div>;
}

function GenericLane({ title, description, items, onAdd, onRemove, fields, render }) {
  return <section className="lane"><header><h2>{title}</h2><p>{description}</p></header><Form fields={fields} onSubmit={onAdd} /><List items={items} onRemove={onRemove} render={render} /></section>;
}

function BodyMap({ state, add, remove }) {
  const ref = useRef(null);
  const mark = (e) => {
    const r = ref.current.getBoundingClientRect();
    add('bodyMarks', { x: Math.round(((e.clientX-r.left)/r.width)*100), y: Math.round(((e.clientY-r.top)/r.height)*100), intensity: 5, sensation: 'unclassified', note: '' });
  };
  return <section className="lane"><header><h2>Body map</h2><p>Click the figure to place a symptom marker. Records remain local to this browser.</p></header>
    <div className="body-grid"><div className="body-map" ref={ref} onClick={mark} role="button" tabIndex="0" aria-label="Body map">
      <svg viewBox="0 0 200 500" aria-hidden="true"><circle cx="100" cy="52" r="34"/><path d="M76 90 Q100 76 124 90 L145 230 128 300 140 470 110 470 100 320 90 470 60 470 72 300 55 230Z"/><path d="M58 112 20 275 44 282 82 148M142 112 180 275 156 282 118 148"/></svg>
      {state.bodyMarks.map((m) => <button key={m.id} className="body-dot" style={{left:`${m.x}%`,top:`${m.y}%`}} title={`${m.sensation}: ${m.note}`} onClick={(e)=>{e.stopPropagation();remove('bodyMarks',m.id);}} />)}
    </div><div><Form fields={[{name:'sensation',label:'Sensation'},{name:'intensity',label:'Intensity 1-10',type:'number'},{name:'note',label:'Context',type:'textarea'}]} onSubmit={(v)=>add('bodyMarks',{x:50,y:50,...v})}/><p className="hint">Click an existing marker to remove it.</p></div></div>
  </section>;
}

function Graph({ nodes = [], relationKey = 'links' }) {
  return <div className="graph">{nodes.map((n, i) => <div className="graph-node" key={n.id} style={{'--i':i}}><strong>{n.name || n.claim || n.title}</strong><small>{n[relationKey] || n.type || n.status}</small></div>)}</div>;
}

function Archive({ state, add, remove }) {
  const [q,setQ]=useState('');
  const filtered=state.archive.filter((x)=>JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));
  return <section className="lane"><header><h2>Conversation archive</h2><p>Every fragment can become searchable project material.</p></header><input className="search" placeholder="Search archive" value={q} onChange={(e)=>setQ(e.target.value)}/><Form fields={[{name:'text',label:'Fragment',type:'textarea'},{name:'lane',label:'Lane',type:'select',options:['archive','animals','body','proof','creative','build','money']},{name:'source',label:'Source'}]} onSubmit={(v)=>add('archive',v)}/><List items={filtered} onRemove={(id)=>remove('archive',id)} render={(x)=><><strong>{x.lane}</strong><p>{x.text}</p><small>{x.source} · {x.created} · {x.privacy}</small></>}/></section>;
}

function CreativeWorld() { const [open,setOpen]=useState(false); return <section className="lane creative-lane"><header><h2>Creative world</h2><p>The original wordless audiovisual sky remains intact as a contained world.</p></header><button onClick={()=>setOpen(!open)}>{open?'Close sky':'Enter sky'}</button>{open&&<div className="sky-shell"><SkyWorld/></div>}</section>; }

function Dashboard({ state, setActive, backendStatus }) {
  const counts = { archive:state.archive.length, symbols:state.symbols.length, evidence:state.evidence.length, animals:state.animals.length, artifacts:state.artifacts.length, projects:state.projects.length };
  return <section className="lane"><header><h2>Mirror Cartographer operating atlas</h2><p>The sky is one world inside the larger map. This is the workshop beneath it: health, memory, evidence, projects, creative work, and the systems that connect them.</p></header><div className="workshop-note"><strong>LOCAL-FIRST / NO AUTOMATIC UPLOAD</strong><span>Records stay in this browser and can be exported by you. Browser storage is not encrypted. Do not enter passwords, Social Security numbers, account numbers, or full identifiers. Shared accounts and cross-person synchronization are not wired into these lanes yet. The deployment API status is shown separately below.</span></div><div className="backend-status" data-state={backendStatus.state} role="status"><strong>DEPLOYMENT API / {backendStatus.label}</strong><span>{backendStatus.message}</span><small>Runtime health is separate from local records. Even when Supabase responds, this workshop remains local until its account and sync flows are connected.</small></div><div className="metrics">{Object.entries(counts).map(([k,v])=><button key={k} onClick={()=>setActive(k)}><strong>{v}</strong><span>{k}</span></button>)}</div><div className="feature-grid">{FEATURES.map(([id,name,description],i)=><button key={id} onClick={()=>setActive(id)}><b>{String(i+1).padStart(2,'0')}</b><strong>{name}</strong><span>{description}</span></button>)}</div><section className="connected-rooms"><header><h3>Rooms connected to the workshop</h3><p>Specialist experiences with their own interfaces and privacy boundaries.</p></header><div className="connected-room-grid"><a href="./?view=workshop&lane=country"><b>The Living Country</b><span>Artist’s field atlas, context switching, and interactive investigation ↗</span></a><a href="./atlas/rooms/signal-loom/"><b>The Signal Loom</b><span>Medical signals and evidence timeline ↗</span></a><a href="./atlas/rooms/body-archive/"><b>The Body Archive</b><span>Private body and clinical notebook ↗</span></a><a href="./atlas/rooms/after-the-uniform/"><b>After the Uniform</b><span>Veteran transition field notes ↗</span></a><a href="./atlas/rooms/screening-room/"><b>The Picture House</b><span>Independent cinema ↗</span></a><a href="./atlas/rooms/common-thread/"><b>Common Thread</b><span>Private relationship constellation ↗</span></a><a href="./atlas/research-atlas/"><b>The Between</b><span>Source-aware research instrument ↗</span></a><a href="./commissions.html"><b>Commissions</b><span>Private research and decision maps ↗</span></a><a href="./workbench.html"><b>Source Workbench</b><span>Play, inspect, and remix HTML experiences ↗</span></a></div></section></section>;
}

export default function OperatingAtlas() {
  const { state, setState, patch, add, remove } = useAtlasState();
  const [active,setActive]=useState(() => { const requested = new URLSearchParams(window.location.search).get('lane'); return FEATURES.some(([id]) => id === requested) ? requested : 'atlas'; });
  const [crisis,setCrisis]=useState(false);
  const [backendStatus,setBackendStatus]=useState({state:'checking',label:'CHECKING',message:'Checking whether this deployment exposes the private persistence API.'});
  const nav=useMemo(()=>FEATURES,[ ]);
  useEffect(()=>{let live=true;if(!infrastructure){setBackendStatus({state:'unavailable',label:'NOT AVAILABLE',message:'No browser API client is available on this host.'});return()=>{live=false}}infrastructure.health().then(data=>{if(!live)return;if(data.persistence==='supabase'&&data.auth==='supabase')setBackendStatus({state:'supabase',label:'SUPABASE RESPONDING',message:'The deployment API reports Supabase persistence and authentication configured.'});else if(data.persistence==='memory')setBackendStatus({state:'memory',label:'MEMORY FALLBACK',message:'The API responds, but records are only in process memory and may disappear on restart.'});else setBackendStatus({state:'unknown',label:'UNKNOWN',message:'The API responds, but its persistence mode is not recognized.'})}).catch(()=>{if(live)setBackendStatus({state:'unavailable',label:'NOT REACHABLE',message:'This host did not return an API health response. The GitHub Pages mirror has no server API; check the Vercel deployment for backend status.'})});return()=>{live=false};},[]);
  useEffect(()=>{document.documentElement.classList.add('mc-operating-atlas');document.body.classList.add('mc-operating-atlas');return()=>{document.documentElement.classList.remove('mc-operating-atlas');document.body.classList.remove('mc-operating-atlas');document.body.classList.remove('atlas-nav-open');};},[]);
  useEffect(()=>{document.documentElement.dataset.atlasContrast=state.accessibility.highContrast?'high':'normal';document.documentElement.dataset.atlasMotion=state.accessibility.reducedMotion?'reduced':'full';document.documentElement.style.fontSize=`${state.accessibility.scale*100}%`;},[state.accessibility]);
  const exportData=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mirror-cartographer-${today()}.json`;a.click();URL.revokeObjectURL(a.href);};

  const lane = (() => {
    if (crisis || active==='crisis') return <section className="lane crisis"><h2>Crisis override</h2><p>Symbolic interpretation is suspended. Use direct language, identify immediate danger, and focus only on the next concrete action. This switch changes the interface; it is not an emergency response service.</p><textarea placeholder="What is happening right now?"/><div className="crisis-resources"><p><strong>Immediate danger or medical emergency:</strong> call 911.</p><p><strong>U.S. crisis support:</strong> call or text 988.</p><p><strong>Veterans:</strong> call 988 and press 1, or text 838255.</p><a href="https://988lifeline.org/" target="_blank" rel="noreferrer">988 Lifeline ↗</a><a href="https://www.veteranscrisisline.net/" target="_blank" rel="noreferrer">Veterans Crisis Line ↗</a></div><button onClick={()=>setCrisis(false)}>Exit crisis mode</button></section>;
    if (active==='atlas') return <Dashboard state={state} setActive={setActive} backendStatus={backendStatus}/>;
    if (active==='country') return <LivingCountry/>;
    if (active==='judgment') return <section className="lane"><header><h2>Human Judgment Lab</h2><p>Agreement is a property of the panel. Accuracy is a property of the answer against a defensible reference. They can move independently.</p></header><article className="list-card"><strong>Experiment 001 / The Consensus Trap</strong><p>Run a seeded simulation. Change the evidence signal, shared bias, independent noise, panel size, and sample count. Export the exact parameters and results so another person can reproduce the run.</p><a href="./field-instruments/consensus-trap.html">OPEN THE REPRODUCIBLE EXPERIMENT ↗</a></article><p className="hint">The experiment uses synthetic outcomes and illustrative parameters. It does not estimate real evaluator behavior.</p></section>;
    if (active==='archive') return <Archive state={state} add={add} remove={remove}/>;
    if (active==='accounts') return <section className="lane"><h2>Identity and accounts</h2><Form fields={[{name:'name',label:'Display name'},{name:'provider',label:'Provider',type:'select',options:['local-only','email-ready','GitHub-ready']}]} onSubmit={(v)=>patch('profile',{...state.profile,...v})}/><pre>{JSON.stringify(state.profile,null,2)}</pre><p className="hint">Provider buttons are architecture boundaries; production OAuth still requires server credentials.</p></section>;
    if (active==='memory') return <section className="lane"><h2>Persistent memory</h2><p>All atlas data is saved to localStorage.</p><button onClick={exportData}>Export memory</button><button className="danger" onClick={()=>{localStorage.removeItem('mc-atlas-v1');setState(seed);}}>Reset memory</button></section>;
    if (active==='sessions') return <section className="lane"><h2>Session modes</h2>{['one-off','persistent','ritual','facilitated','group'].map(x=><button className={state.profile.mode===x?'selected':''} onClick={()=>patch('profile',{...state.profile,mode:x})} key={x}>{x}</button>)}</section>;
    if (active==='tone') return <section className="lane"><h2>Tone modes</h2>{['symbolic','neutral','scientific','adaptive'].map(x=><button className={state.profile.tone===x?'selected':''} onClick={()=>patch('profile',{...state.profile,tone:x})} key={x}>{x}</button>)}</section>;
    if (active==='symbols') return <GenericLane title="Symbol engine" description="Meanings are versionable rather than fixed." items={state.symbols} onAdd={(v)=>add('symbols',{...v,history:[{date:today(),meaning:v.meaning}]})} onRemove={(id)=>remove('symbols',id)} fields={[{name:'name',label:'Symbol or glyph'},{name:'meaning',label:'Current meaning',type:'textarea'},{name:'links',label:'Linked concepts'}]} render={(x)=><><strong>{x.name}</strong><p>{x.meaning}</p><small>{x.links}</small></>}/>;
    if (active==='body') return <BodyMap state={state} add={add} remove={remove}/>;
    if (active==='health') return <GenericLane title="Human health continuity" description="Observation and organization, not diagnosis." items={state.health} onAdd={(v)=>add('health',v)} onRemove={(id)=>remove('health',id)} fields={[{name:'type',label:'Type',type:'select',options:['symptom','lab','imaging','medication','question']},{name:'title',label:'Title'},{name:'detail',label:'Details',type:'textarea'}]} render={(x)=><><strong>{x.type}: {x.title}</strong><p>{x.detail}</p></>}/>;
    if (active==='animals') return <GenericLane title="Animal health continuity" description="One longitudinal lane per animal." items={state.animals} onAdd={(v)=>add('animals',v)} onRemove={(id)=>remove('animals',id)} fields={[{name:'name',label:'Animal name'},{name:'species',label:'Species'},{name:'notes',label:'Current continuity note',type:'textarea'}]} render={(x)=><><strong>{x.name} · {x.species}</strong><p>{x.notes}</p></>}/>;
    if (active==='vet') return <GenericLane title="Veterinary connector architecture" description="Tracks sources without storing passwords or scraping portals." items={state.vetSources} onAdd={(v)=>add('vetSources',v)} onRemove={(id)=>remove('vetSources',id)} fields={[{name:'clinic',label:'Clinic/provider'},{name:'method',label:'Connection method',type:'select',options:['manual upload','email attachment','API-ready']},{name:'status',label:'Status',type:'select',options:['planned','connected','needs review']}]} render={(x)=><><strong>{x.clinic}</strong><p>{x.method} · {x.status}</p></>}/>;
    if (active==='vet-import'||active==='imports') return <section className="lane"><h2>Data import center</h2><p>Files are indexed locally by metadata; their contents are not uploaded by this prototype.</p><input type="file" multiple onChange={(e)=>[...e.target.files].forEach(f=>add('imports',{name:f.name,size:f.size,type:f.type,kind:active==='vet-import'?'vet record':'general'}))}/><List items={state.imports} onRemove={(id)=>remove('imports',id)} render={(x)=><><strong>{x.name}</strong><p>{x.kind} · {x.type||'unknown'} · {Math.round(x.size/1024)} KB</p></>}/></section>;
    if (active==='fiv') return <GenericLane title="FIV research lane" description="No cure claim without evidence." items={state.research} onAdd={(v)=>add('research',v)} onRemove={(id)=>remove('research',id)} fields={[{name:'claim',label:'Research claim'},{name:'evidence',label:'Evidence/source',type:'textarea'},{name:'status',label:'Status',type:'select',options:['fact','hypothesis','unknown','contradicted']}]} render={(x)=><><strong>{x.claim}</strong><p>{x.evidence}</p><small>{x.status}</small></>}/>;
    if (active==='proof') return <section className="lane"><h2>Evidence graph</h2><Form fields={[{name:'claim',label:'Claim'},{name:'type',label:'Type',type:'select',options:['fact','inference','symbolic','hypothesis','action']},{name:'source',label:'Source or rationale'}]} onSubmit={(v)=>add('evidence',v)}/><Graph nodes={state.evidence}/><List items={state.evidence} onRemove={(id)=>remove('evidence',id)} render={(x)=><><strong>{x.type}: {x.claim}</strong><p>{x.source}</p></>}/></section>;
    if (active==='concepts') return <section className="lane"><h2>Concept graph</h2><Form fields={[{name:'name',label:'Concept'},{name:'links',label:'Related concepts'},{name:'meaning',label:'Meaning',type:'textarea'}]} onSubmit={(v)=>add('concepts',v)}/><Graph nodes={state.concepts}/><List items={state.concepts} onRemove={(id)=>remove('concepts',id)} render={(x)=><><strong>{x.name}</strong><p>{x.meaning}</p><small>{x.links}</small></>}/></section>;
    if (active==='decisions') return <GenericLane title="Decision log" description="Decisions can be active, reversed, or superseded." items={state.decisions} onAdd={(v)=>add('decisions',v)} onRemove={(id)=>remove('decisions',id)} fields={[{name:'title',label:'Decision'},{name:'reason',label:'Reason',type:'textarea'},{name:'status',label:'Status',type:'select',options:['active','superseded','reversed']}]} render={(x)=><><strong>{x.title}</strong><p>{x.reason}</p><small>{x.status}</small></>}/>;
    if (active==='projects') return <section className="lane"><h2>Project graph and evolution timeline</h2><Form fields={[{name:'name',label:'Project'},{name:'status',label:'Status',type:'select',options:['active','planned','paused','obsolete','complete']},{name:'links',label:'Dependencies'}]} onSubmit={(v)=>add('projects',v)}/><Graph nodes={state.projects}/><List items={state.projects} onRemove={(id)=>remove('projects',id)} render={(x)=><><strong>{x.name}</strong><p>{x.status}</p><small>{x.links}</small></>}/></section>;
    if (active==='creative') return <CreativeWorld/>;
    if (active==='access') return <section className="lane"><h2>Accessibility</h2>{Object.entries(state.accessibility).map(([k,v])=>k==='scale'?<label key={k}>Text scale <input type="range" min="0.85" max="1.35" step="0.05" value={v} onChange={(e)=>patch('accessibility',{...state.accessibility,scale:Number(e.target.value)})}/></label>:<label key={k}><input type="checkbox" checked={v} onChange={(e)=>patch('accessibility',{...state.accessibility,[k]:e.target.checked})}/>{k}</label>)}</section>;
    if (active==='privacy') return <section className="lane"><h2>Privacy controls</h2><p className="hint">These controls classify local records; they do not encrypt them or publish them. Browser storage is not encrypted by this app. Avoid passwords, Social Security numbers, account numbers, and full identifiers.</p><label>Default classification <select value={state.privacy.default} onChange={(e)=>patch('privacy',{...state.privacy,default:e.target.value})}><option>private</option><option>sensitive</option><option>public-safe</option></select></label><label><input type="checkbox" checked={state.privacy.publicSafe} onChange={(e)=>patch('privacy',{...state.privacy,publicSafe:e.target.checked})}/>Public-safe mode</label></section>;
    if (active==='artifacts') return <GenericLane title="Artifact library" description="Versioned maps, packets, and reports." items={state.artifacts} onAdd={(v)=>add('artifacts',{...v,version:1})} onRemove={(id)=>remove('artifacts',id)} fields={[{name:'title',label:'Artifact title'},{name:'type',label:'Type',type:'select',options:['packet','map','report','visual','export']},{name:'summary',label:'Summary',type:'textarea'}]} render={(x)=><><strong>{x.title} · v{x.version}</strong><p>{x.summary}</p><small>{x.type}</small></>}/>;
    if (active==='demos') return <section className="lane"><h2>Public demo packets</h2>{['Pet Health Continuity Packet','Personal Medical Continuity Packet','AI Archive Recovery Map','Symbolic Systems Map','Research Evidence Map'].map(t=><button key={t} onClick={()=>add('artifacts',{title:t,type:'public demo',summary:'Public-safe generated demonstration packet.',version:1})}>Generate {t}</button>)}</section>;
    if (active==='offers') return <><div className="workshop-note"><strong>OFFER DRAFTS / NOT A STOREFRONT</strong><span>Use this lane to define services and track intake status. It does not publish a checkout page or collect payment.</span></div><GenericLane title="Paid offers" description="Service definitions and intake status." items={state.offers} onAdd={(v)=>add('offers',v)} onRemove={(id)=>remove('offers',id)} fields={[{name:'title',label:'Offer title'},{name:'price',label:'Price or exchange'},{name:'status',label:'Status',type:'select',options:['draft','live','paused']},{name:'deliverable',label:'Deliverable',type:'textarea'}]} render={(x)=><><strong>{x.title} · {x.price}</strong><p>{x.deliverable}</p><small>{x.status}</small></>}/></>;
    if (active==='support') return <><div className="workshop-note"><strong>LINK REGISTER ONLY</strong><span>This lane stores destination labels and URLs. It does not process payments or verify an external payment account.</span></div><GenericLane title="Payments, sponsorship, and barter" description="Configurable support destinations." items={state.support} onAdd={(v)=>add('support',v)} onRemove={(id)=>remove('support',id)} fields={[{name:'label',label:'Label'},{name:'url',label:'URL'},{name:'type',label:'Type',type:'select',options:['payment','sponsorship','barter','material support']}]} render={(x)=><><strong>{x.label}</strong><p>{x.type}</p><code>{x.url}</code></>}/></>;
    if (active==='money') { const gap=state.money.reduce((s,x)=>s+(Number(x.need)||0)-(Number(x.expected)||0),0); return <section className="lane"><h2>Money and stability</h2><div className="big-number">Gap: ${gap.toLocaleString()}</div><Form fields={[{name:'title',label:'Need or income source'},{name:'need',label:'Need amount',type:'number'},{name:'expected',label:'Expected income',type:'number'}]} onSubmit={(v)=>add('money',v)}/><List items={state.money} onRemove={(id)=>remove('money',id)} render={(x)=><><strong>{x.title}</strong><p>Need ${x.need||0} · Expected ${x.expected||0}</p></>}/></section>; }
    if (active==='film') return <GenericLane title="Proof film" description="Storyboard and production tracker." items={state.film} onAdd={(v)=>add('film',v)} onRemove={(id)=>remove('film',id)} fields={[{name:'title',label:'Scene'},{name:'purpose',label:'What this proves',type:'textarea'},{name:'status',label:'Status',type:'select',options:['idea','scripted','captured','edited','published']}]} render={(x)=><><strong>{x.title}</strong><p>{x.purpose}</p><small>{x.status}</small></>}/>;
    if (active==='offline') return <section className="lane"><h2>Standalone fallback</h2><p>This atlas is local-first and exportable. A production installable PWA still requires a service worker and manifest deployment.</p><button onClick={exportData}>Export offline bundle</button></section>;
    if (active==='public') return <section className="lane"><h2>Public-safe cleanup</h2>{['Review raw conversations','Remove identifiers','Redact medical records','Redact veterinary records','Check financial details','Verify claims and sources','Mark demo vs production'].map(x=><label key={x}><input type="checkbox"/>{x}</label>)}</section>;
    if (active==='arc') return <GenericLane title="ARC solver expansion lab" description="Benchmark claims require measured improvement." items={state.arc} onAdd={(v)=>add('arc',v)} onRemove={(id)=>remove('arc',id)} fields={[{name:'title',label:'Experiment'},{name:'primitive',label:'Primitive or capability'},{name:'score',label:'Benchmark score'},{name:'result',label:'Failure summary',type:'textarea'}]} render={(x)=><><strong>{x.title} · {x.score}</strong><p>{x.primitive}</p><small>{x.result}</small></>}/>;
    return <Dashboard state={state} setActive={setActive} backendStatus={backendStatus}/>;
  })();

  return <div className={`operating-atlas ${state.accessibility.textMode?'text-mode':''}`}>
    <a className="skip" href="#atlas-main">Skip to content</a>
    <aside><div className="brand"><span>MC</span><strong>Mirror Cartographer</strong><small>continuity atlas</small></div><nav>{nav.map(([id,name],i)=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}><b>{String(i+1).padStart(2,'0')}</b>{name}</button>)}</nav></aside>
    <header className="topbar"><button className="menu" onClick={()=>document.body.classList.toggle('atlas-nav-open')}>☰</button><a className="field-return" href="./">← BACK TO THE FIELD</a><span>{FEATURES.find(x=>x[0]===active)?.[1]||'Atlas'}</span><button className="crisis-button" onClick={()=>setCrisis(true)}>Crisis override</button></header>
    <main id="atlas-main">{lane}</main>
  </div>;
}
