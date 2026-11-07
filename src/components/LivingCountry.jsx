import React, { useEffect, useMemo, useState } from 'react';
import './LivingCountry.css';

const NOTE_KEY = 'mc-living-country-v2';
const TEST_KEY = 'mc-living-country-investigations-v1';
const seed = [
  { id:'weather', title:'Weather inside a thought', kind:'field note', body:'A feeling can change the whole landscape without changing the facts beneath it.', context:'embodied', x:18, y:24, origin:'seed' },
  { id:'echo', title:'The echo that kept returning', kind:'question', body:'What repeats, what changes, and what is only being heard more loudly?', context:'temporal', x:50, y:13, origin:'seed' },
  { id:'moss', title:'Moss on the machine', kind:'connection', body:'Living systems and built systems both carry traces of their conditions.', context:'systems', x:78, y:29, origin:'seed' },
  { id:'shore', title:'A shoreline is not a border', kind:'hypothesis', body:'Boundaries can be interfaces where exchange happens, not merely walls.', context:'relational', x:30, y:67, origin:'seed' },
  { id:'lantern', title:'The lantern test', kind:'experiment', body:'Change one condition. Record what changes and what stays put.', context:'measurement', x:72, y:73, origin:'seed' },
];
const contexts = ['embodied','temporal','systems','relational','measurement','language','care'];
const contextNotes = {
  embodied: { title:'Body / sensation', reveals:'Timing, location, intensity, triggers, recovery, and the difference between a reported sensation and a measured signal.', asks:'What changes when the same sensation is recorded at different times or under different conditions?', limit:'A sensation is real as an experience; it does not identify its mechanism by itself.' },
  temporal: { title:'Time / sequence', reveals:'Onset, duration, recurrence, lag, order, and whether a pattern persists prospectively.', asks:'What should happen next if this pattern is stable rather than a coincidence?', limit:'A sequence can suggest a relationship without proving causation.' },
  systems: { title:'Systems / environment', reveals:'Inputs, constraints, feedback loops, resources, thresholds, and downstream effects.', asks:'Which variable changes first, and which changes only after a delay?', limit:'A system diagram is a model of relationships, not proof that every arrow is causal.' },
  relational: { title:'Relationships / boundaries', reveals:'Who or what is connected, where information is lost, and what changes at an interface.', asks:'What information crosses this boundary, and what gets filtered out?', limit:'Similarity or proximity does not establish a shared cause.' },
  measurement: { title:'Measurement / instruments', reveals:'Units, calibration, sampling, uncertainty, missing values, and the gap between a measure and its target.', asks:'Would an independent instrument or blinded repeat produce the same result?', limit:'A number is not self-interpreting; provenance and measurement conditions matter.' },
  language: { title:'Language / meaning', reveals:'How names, metaphors, audience, and surrounding context change the interpretation of an event.', asks:'Does the underlying observation stay the same when the words used to describe it change?', limit:'A compelling metaphor can organize attention but cannot substitute for evidence.' },
  care: { title:'Care / consequence', reveals:'What decision is being made, who bears the cost of error, and what support or safeguard is needed.', asks:'What is the lowest-risk next step while uncertainty remains?', limit:'A care-oriented choice is not automatically a factual explanation.' },
};
const readArray = (key, fallback) => {
  try { const raw=localStorage.getItem(key); if(raw===null) return fallback; const parsed=JSON.parse(raw); return Array.isArray(parsed)?parsed: fallback; }
  catch { return fallback; }
};
const readNotes = () => { const current=readArray(NOTE_KEY,null); const source=current===null?readArray('mc-living-country-v1',seed):current; return source.map((n,i)=>({...n,id:n.id||'migrated-'+i,context:contexts.includes(n.context)?n.context:'embodied',kind:n.kind||'field note',x:Number.isFinite(n.x)?n.x:18+((i*19)%72),y:Number.isFinite(n.y)?n.y:17+((i*27)%66),origin:n.origin||(seed.some(s=>s.id===n.id)?'seed':'user')})); };
const makeId = () => globalThis.crypto?.randomUUID?.() || 'entry-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const downloadJSON = (name, data) => {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

export default function LivingCountry() {
  const [notes,setNotes] = useState(readNotes);
  const [investigations,setInvestigations] = useState(()=>readArray(TEST_KEY,[]));
  const [selected,setSelected] = useState('weather');
  const [context,setContext] = useState('all');
  const [lens,setLens] = useState('notebook');
  const [draft,setDraft] = useState('');
  const [kind,setKind] = useState('field note');
  const [draftContext,setDraftContext] = useState('embodied');
  const [healthOpen,setHealthOpen] = useState(false);
  const [companion,setCompanion] = useState('O’Malley');
  const [territory,setTerritory] = useState('room');
  const [shape,setShape] = useState('A light behind a curtain.');
  const [booth,setBooth] = useState('category');
  const [departure,setDeparture] = useState('');
  const [arrival,setArrival] = useState('');
  const [orchardId,setOrchardId] = useState('weather');
  const [contrastId,setContrastId] = useState('echo');
  const [retireId,setRetireId] = useState('');
  const [thunderIds,setThunderIds] = useState({question:'echo',detail:'weather',system:'moss'});
  const [reflection,setReflection] = useState('');
  const [noteStatus,setNoteStatus] = useState('Notes are stored only in this browser. No account or upload is connected.');
  const [testStatus,setTestStatus] = useState('');
  const [testDraft,setTestDraft] = useState({question:'',observation:'',interpretation:'',alternative:'',prediction:'',falsifier:''});
  const [expandedTest,setExpandedTest] = useState('');

  const visibleNotes = useMemo(()=>notes.filter(n=>context==='all'||n.context===context),[notes,context]);
  const current = visibleNotes.find(n=>n.id===selected) || visibleNotes[0] || null;
  const guide = context==='all' ? null : contextNotes[context];
  const contrastOptions = notes.filter(n=>n.id!==current?.id);
  const selectedContrastId = contrastOptions.some(n=>n.id===contrastId)?contrastId:(contrastOptions[0]?.id||'');
  const selectedAfterimageId = notes.some(n=>n.id===orchardId)?orchardId:(notes[0]?.id||'');
  const retirableNotes = notes.filter(n=>n.origin==='user'&&['hypothesis','interpretation'].includes(n.kind)&&n.status!=='retired');
  const selectedRetireId = retirableNotes.some(n=>n.id===retireId)?retireId:(retirableNotes[0]?.id||'');
  const faultlineOther = contrastOptions.find(n=>n.id===selectedContrastId);
  const lensReading = current ? (lens==='notebook' ? {label:'FIELD READING / METAPHOR IS A TOOL',text:'Let this fragment act like a lantern, not a verdict. Follow the image, notice what it helps you see, and leave room for it to be wrong.'} : {label:'PLAIN-LANGUAGE READING / EVIDENCE BOUNDARY',text:`This is a ${current.kind} recorded under the ${contextNotes[current.context]?.title||current.context} context. The next useful step is to identify an observable prediction and a result that would count against the interpretation. This fragment alone does not establish cause.`}) : null;

  useEffect(()=>{ if(current && current.id!==selected) setSelected(current.id); },[current?.id,selected]);
  const persistNotes = next => {
    setNotes(next);
    try { localStorage.setItem(NOTE_KEY,JSON.stringify(next)); setNoteStatus('Saved locally in this browser.'); }
    catch { setNoteStatus('Could not save: browser storage may be full or unavailable. Export your notes before leaving.'); }
  };
  const persistTests = next => {
    setInvestigations(next);
    try { localStorage.setItem(TEST_KEY,JSON.stringify(next)); setTestStatus('Investigation saved locally.'); }
    catch { setTestStatus('Could not save this investigation. Export your notebook before leaving.'); }
  };
  const addNote = e => {
    e.preventDefault(); const body=draft.trim(); if(!body) return;
    const firstLine=body.split('\n')[0];
    const item={id:makeId(),title:firstLine.slice(0,58),body,kind,context:draftContext,x:14+((notes.length*19)%72),y:17+((notes.length*27)%66),origin:'user',createdAt:new Date().toISOString()};
    persistNotes([item,...notes]); setSelected(item.id); setContext('all'); setDraft('');
  };
  const removeNote = id => { const next=notes.filter(n=>n.id!==id); persistNotes(next); setSelected(next[0]?.id||''); };
  const addTerritoryNote = (title,body,noteKind='field note',noteContext='language') => {
    const item={id:makeId(),title,body,kind:noteKind,context:noteContext,x:14+((notes.length*23)%72),y:17+((notes.length*31)%66),origin:'user',createdAt:new Date().toISOString()};
    persistNotes([item,...notes]);setSelected(item.id);setContext('all');return item;
  };
  const boothData = {
    category:{label:'Choose a category',line:'The form accepts the category but not the condition that made it matter.',question:'What context was lost when the experience was sorted?'},
    simplify:{label:'Make it simpler',line:'The system compresses the record until the exception disappears.',question:'Which detail must survive simplification for the account to remain true?'},
    unrelated:{label:'This is unrelated',line:'A connection is dismissed before anyone checks whether the relationship is structural.',question:'What shared variable or mechanism would make these two observations relevant to each other?'},
    field:{label:'There is no field for that',line:'The experience exists, but the interface has no place to represent it.',question:'What new field, relationship, or representation would preserve the missing information?'},
    prove:{label:'Come back when you can prove it',line:'The burden of proof arrives before the system has helped define what could count as evidence.',question:'What is the smallest safe, observable test that could change the decision?'},
  };
  const pinShape = () => addTerritoryNote('Before the room',shape,'field note','language');
  const pinBooth = () => { const b=boothData[booth];addTerritoryNote('Carnival booth / '+b.label,b.line+'\n\nQuestion to carry: '+b.question,'contradiction','systems'); };
  const pinJourney = () => addTerritoryNote('Ocean terminal / departure and arrival','Departure: '+(departure.trim()||'not yet named')+'\nArrival: '+(arrival.trim()||'not yet named')+'\n\nThe distance between them may be a delay, a missing transition, or a change in direction. Record the sequence before explaining it.','field note','temporal');
  const revisitAfterimage = () => { const found=notes.find(n=>n.id===orchardId);if(found){setSelected(found.id);setContext('all');} };
  const retireCurrent = () => { const claim=retirableNotes.find(n=>n.id===selectedRetireId);if(!claim)return;persistNotes(notes.map(n=>n.id===claim.id?{...n,status:'retired',retiredAt:new Date().toISOString()}:n));setRetireId(''); };
  const holdFaultline = () => { const other=notes.find(n=>n.id===selectedContrastId);if(!current||!other||other.id===current.id)return;addTerritoryNote('Velvet faultline / '+current.title+' × '+other.title,'First account: '+current.body+'\n\nSecond account: '+other.body+'\n\nHold the difference. Do not collapse either statement just to make the page look clean.','contradiction','relational'); };
  const doorText = () => { const q=notes.find(n=>n.id===thunderIds.question),d=notes.find(n=>n.id===thunderIds.detail),s=notes.find(n=>n.id===thunderIds.system);return 'A question that kept returning: '+(q?.title||'not chosen')+'.\nA small thing treated as if it mattered: '+(d?.title||'not chosen')+'.\nA system condition someone refused to call inevitable: '+(s?.title||'not chosen')+'.\n\nWhat could be made where these three meet?'; };
  const makeDoor = () => addTerritoryNote('The door made of thunder',doorText(),'question','systems');
  const saveReflection = () => { if(!reflection.trim())return;addTerritoryNote('Room after reading',reflection.trim(),'field note','language');setReflection(''); };
  const changeNoteContext = value => { if(!current||current.origin==='seed') return; persistNotes(notes.map(n=>n.id===current.id?{...n,context:value}:n)); setContext(value); };
  const addInvestigation = e => {
    e.preventDefault();
    const item={id:makeId(),...testDraft,createdAt:new Date().toISOString(),status:'untested',result:''};
    persistTests([item,...investigations]); setExpandedTest(item.id); setTestDraft({question:'',observation:'',interpretation:'',alternative:'',prediction:'',falsifier:''});
  };
  const updateInvestigation = (id,patch) => persistTests(investigations.map(item=>item.id===id?{...item,...patch,updatedAt:new Date().toISOString()}:item));
  const removeInvestigation = id => persistTests(investigations.filter(item=>item.id!==id));
  const exportNotebook = () => downloadJSON('mirror-cartographer-living-country.json',{schemaVersion:2,exportedAt:new Date().toISOString(),notes,investigations});

  return <main className="living-country">
    <header className="country-head"><a href="./">← FIELD ENTRANCE</a><span>THE UNFINISHED CONSTELLATION / FIELD COPY 07</span><button type="button" onClick={()=>setLens(lens==='notebook'?'plain':'notebook')}>{lens==='notebook'?'INK / METAPHOR':'PLAIN / OBSERVABLE'}</button></header>

    <section className="country-opening">
      <div className="opening-scratch" aria-hidden="true"><svg viewBox="0 0 620 280"><path d="M18 180 C90 20 160 270 260 115 S420 10 590 155" /><path d="M40 220 Q190 70 310 200 T585 90"/><path d="M105 20 L155 75 L125 130 L180 180"/></svg></div>
      <p className="ink-label">A FIELD NOTE FROM THE EDGE OF THE MAP</p>
      <h1>THE LIVING<br/><i>COUNTRY.</i></h1>
      <p className="opening-copy">{lens==='notebook'?'A place where scraps of meaning grow wild. Some are beautiful. Some contradict each other. None gets to become a fact just because it glows.':'A workspace for recording observations, interpretations, competing explanations, predictions, and tests. Each claim remains revisable.'}</p>
      <div className="opening-stamp">NOT A DIAGNOSIS<br/>NOT A MAP OF YOU<br/>FIELD COPY / 07</div>
      <span className="opening-margin">KEEP THE STRANGE PART.<br/>CHECK THE CLAIM.</span>
    </section>

    <section className="pet-marginalia" aria-label="Companion field notes">
      <span className="ink-label">MARGINALIA / THREE SMALL WITNESSES</span>
      <div>{[['O’Malley','night archivist'],['Bug','threshold inspector'],['Nimbus','weather watcher']].map(([name,role])=><button type="button" key={name} className={companion===name?'chosen':''} onClick={()=>setCompanion(name)}>{name}<small>{role}</small></button>)}</div>
      <p>{companion==='O’Malley'?'Keeps the quiet records, including the ones nobody thought to file.':companion==='Bug'?'Checks every threshold. Prefers a door that stays open.':'Notices the weather before the map admits it has changed.'}</p>
    </section>

    <section className="lyr-passage" aria-label="LYR territories">
      <div className="lyr-heading"><span className="ink-label">LYR / THE UNFINISHED DOOR</span><h2>Eight territories.<br/><i>No assigned meaning.</i></h2><p>Come in by any door. These rooms are made from images, questions, and contradictions. They are not tests of you. Nothing here decides what you feel.</p></div>
      <nav className="territory-tabs" aria-label="Choose a territory">{[
        ['room','I / BEFORE'],['carnival','II / CARNIVAL'],['ocean','III / OCEAN'],['orchard','IV / ORCHARD'],['funeral','V / FUNERAL'],['faultline','VI / FAULTLINE'],['thunder','VII / THUNDER'],['after','VIII / AFTER']
      ].map(([id,label])=><button type="button" key={id} aria-pressed={territory===id} onClick={()=>setTerritory(id)}>{label}</button>)}</nav>
      <article className={'territory-scene scene-'+territory}>
        {territory==='room'&&<><span className="scene-index">I / THE ROOM BEFORE THE ROOM</span><h3>What if the record is complete,<br/>and understanding is still missing?</h3><p>Before an explanation, there is a shape. It might be a light behind a curtain, a stone held underwater, a hallway that lengthens when approached, or no image at all.</p><div className="scene-controls"><label>CHOOSE A SHAPE<select aria-label="Choose a shape" value={shape} onChange={e=>setShape(e.target.value)}>{['A light behind a curtain.','A stone held underwater.','A hallway that lengthens when approached.','A bird calling from somewhere unseen.','A rhythm with no image.','No image. Just a change in pressure.'].map(x=><option key={x}>{x}</option>)}</select></label><button type="button" onClick={pinShape}>KEEP THIS FRAGMENT ↗</button></div></>}
        {territory==='carnival'&&<><span className="scene-index">II / STATIC CARNIVAL</span><h3>Every booth promises an explanation.</h3><p>The lights are too bright. The music is almost familiar. Choose the booth that sounds most like a system you have encountered. Then inspect what it cannot see.</p><div className="booth-row">{Object.entries(boothData).map(([id,b])=><button type="button" key={id} aria-pressed={booth===id} onClick={()=>setBooth(id)}>{b.label}</button>)}</div><div className="booth-reveal"><b>WHAT THE BOOTH CANNOT SEE</b><p>{boothData[booth].line}</p><small>NEXT QUESTION: {boothData[booth].question}</small></div><button type="button" onClick={pinBooth}>PIN THE BLIND SPOT ↗</button></>}
        {territory==='ocean'&&<><span className="scene-index">III / OCEAN TERMINAL</span><h3>The map says here.<br/>The body says toward.</h3><p>Departures are printed in clean rows. Arrivals are delayed. Record the two ends without pretending the route is already understood.</p><div className="scene-controls scene-two"><label>DEPARTURE<input value={departure} onChange={e=>setDeparture(e.target.value)} placeholder="What was the starting condition?"/></label><label>ARRIVAL<input value={arrival} onChange={e=>setArrival(e.target.value)} placeholder="What changed or arrived?"/></label><button type="button" onClick={pinJourney}>RECORD THE CROSSING ↗</button></div></>}
        {territory==='orchard'&&<><span className="scene-index">IV / AFTERIMAGE ORCHARD</span><h3>Nothing here grows in a straight line.</h3><p>A sentence you almost deleted. A room you remember by its temperature. A question returning years later under a different name. Choose a trace and let it become visible again.</p><div className="scene-controls"><label>CHOOSE AN AFTERIMAGE<select aria-label="Choose an afterimage" value={selectedAfterimageId} onChange={e=>setOrchardId(e.target.value)}>{notes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label><button type="button" disabled={!notes.length} onClick={revisitAfterimage}>TURN THE LIGHT ↗</button></div></>}
        {territory==='funeral'&&<><span className="scene-index">V / SIGNAL FUNERAL</span><h3>We do not burn the evidence.</h3><p>This is a funeral for explanations that could not carry what they promised to carry. Retire a user-authored hypothesis without deleting its observations or history.</p><div className="retire-slip">{retirableNotes.length?<><label>CHOOSE A CLAIM TO RETIRE<select aria-label="Choose a claim to retire" value={selectedRetireId} onChange={e=>setRetireId(e.target.value)}>{retirableNotes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label><small>Retirement changes the claim's status; it does not erase the source notes.</small><button type="button" onClick={retireCurrent}>RETIRE THIS EXPLANATION ↗</button></>:<p>No unretired user-authored hypothesis is available. Observations remain untouched.</p>}</div></>}
        {territory==='faultline'&&<><span className="scene-index">VI / VELVET FAULTLINE</span><h3>Do not resolve the tension just to make the page look clean.</h3><p>Choose two fragments that do not quite agree. Their difference may be the most informative part of the map.</p><div className="scene-controls"><label>HOLD THIS BESIDE THE SELECTED FRAGMENT<select aria-label="Choose a contrasting fragment" value={selectedContrastId} onChange={e=>setContrastId(e.target.value)}>{contrastOptions.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label><button type="button" disabled={!current||!faultlineOther} onClick={holdFaultline}>KEEP BOTH IN VIEW ↗</button></div><div className="faultline-pair"><article><small>FIRST ACCOUNT</small><b>{current?.title||'No first fragment'}</b><p>{current?.body||'Choose a mark on the map.'}</p></article><article><small>SECOND ACCOUNT</small><b>{faultlineOther?.title||'No contrasting fragment'}</b><p>{faultlineOther?.body||'Add another fragment to make a comparison.'}</p></article></div></>}
        {territory==='thunder'&&<><span className="scene-index">VII / THE DOOR MADE OF THUNDER</span><h3>Raw material first.<br/>Explanation second.</h3><p>Build a door from three things: a question that kept returning, a small thing treated as if it mattered, and a system failure someone refused to call inevitable.</p><div className="scene-controls scene-three">{[['question','THE RETURNING QUESTION'],['detail','THE SMALL THING'],['system','THE SYSTEM FAILURE']].map(([key,label])=><label key={key}>{label}<select value={thunderIds[key]} onChange={e=>setThunderIds({...thunderIds,[key]:e.target.value})}>{notes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>)}</div><blockquote className="door-preview">{doorText()}</blockquote><button type="button" disabled={!notes.length} onClick={makeDoor}>MAKE THE NEXT THING ↗</button></>}
        {territory==='after'&&<><span className="scene-index">VIII / THE ROOM AFTER READING</span><h3>Do not summarize too quickly.</h3><p>Which image stayed? Which line changed the temperature of the room? What did you want to reject? If nothing stayed, that is also information.</p><label className="reflection-label">LEAVE ONE TRACE<textarea value={reflection} onChange={e=>setReflection(e.target.value)} rows="3" placeholder="A line, an image, a refusal, or nothing at all…"/></label><button type="button" disabled={!reflection.trim()} onClick={saveReflection}>SAVE THE AFTERIMAGE ↗</button></>}
      </article>
    </section>
    <section className="country-map-section">
      <div className="section-scribble"><span>01 / THE OVERGROWN MAP</span><span>CLICK A MARK. FOLLOW A THREAD.</span></div>
      <div className="country-map" role="group" aria-label="Interactive map of field notes">
        <div className="map-grid" aria-hidden="true"/><div className="map-river" aria-hidden="true"/>
        <svg className="map-thread" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={notes.map(n=>`${n.x*10},${n.y*6}`).join(' ')} />
          <path d="M70 510 C190 430 140 330 320 300 S520 390 680 220 S830 210 930 75"/>
          <path d="M120 80 Q280 160 390 55 T720 130"/>
        </svg>
        {visibleNotes.map((n,i)=><button type="button" key={n.id} className={'map-mark '+(current?.id===n.id?'chosen':'')+(n.origin==='user'?' user-mark':'')} style={{'--mx':n.x+'%','--my':n.y+'%','--tilt':((i%5)-2)*3+'deg'}} onClick={()=>setSelected(n.id)} aria-pressed={current?.id===n.id}><span>{String(i+1).padStart(2,'0')} / {n.kind}</span>{n.title}</button>)}
        <span className="map-coordinate north">N / THE INK IS STILL WET</span><span className="map-coordinate south">S / THE UNFINISHED EDGE</span>
        <span className="map-scribble scribble-one">not all paths<br/>are roads</span><span className="map-scribble scribble-two">← return is a direction</span>
      </div>
      <div className="map-controls">
        <label>READ THROUGH <select aria-label="Read through context" value={context} onChange={e=>setContext(e.target.value)}><option value="all">All territories</option>{contexts.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <span>{visibleNotes.length} marks visible / {notes.length} in the notebook</span>
      </div>
      {guide&&<aside className="context-slip"><span className="ink-label">CONTEXT SWITCH / {guide.title.toUpperCase()}</span><p><b>What becomes visible:</b> {guide.reveals}</p><p><b>New question:</b> {guide.asks}</p><p><b>What this cannot prove:</b> {guide.limit}</p></aside>}
      {current&&<article className="selected-fragment">
        <div><small>{current.kind} / {current.context} {current.origin==='user'?'· YOUR NOTE':'· FIELD SEED'} {current.status==='retired'?'· RETIRED CLAIM':''}</small><h2>{current.title}</h2><p>{current.body}</p><aside className={'lens-reading '+lens} aria-live="polite"><b>{lensReading.label}</b><p>{lensReading.text}</p></aside>
          {current.origin==='user'&&<label className="reclassify">MOVE THIS FRAGMENT<select aria-label="Move fragment to context" value={current.context} onChange={e=>changeNoteContext(e.target.value)}>{contexts.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
        </div>
        <div className="fragment-actions">{current.origin==='user'&&<button type="button" onClick={()=>removeNote(current.id)}>REMOVE NOTE</button>}<button type="button" onClick={()=>{setContext(current.context);document.querySelector('.context-slip')?.scrollIntoView({behavior:'smooth',block:'nearest'});}}>ISOLATE THIS TERRITORY ↗</button></div>
      </article>}
    </section>

    <section className="country-workbench">
      <div className="section-scribble"><span>02 / LEAVE A TRACE</span><span>LOCAL NOTEBOOK / PRIVATE TO THIS BROWSER</span></div>
      <form onSubmit={addNote} className="country-form">
        <label>NEW FRAGMENT<textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="A detail, an oddity, a question, a thing you noticed…" required rows="3"/></label>
        <div className="form-bottom">
          <label>TYPE<select value={kind} onChange={e=>setKind(e.target.value)}>{['field note','question','connection','hypothesis','experiment','contradiction'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>CONTEXT<select aria-label="New fragment context" value={draftContext} onChange={e=>setDraftContext(e.target.value)}>{contexts.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <button type="submit">PIN TO THE COUNTRY +</button>
        </div>
        <small role="status" aria-live="polite">{noteStatus}</small>
      </form>
    </section>

    <section className="country-investigation">
      <div className="section-scribble"><span>03 / THE INVESTIGATION TABLE</span><span>MAKE A CLAIM THAT CAN LOSE</span></div>
      <p className="investigation-intro">A hypothesis is not a discovery. Write down what was observed, what else could explain it, and what result would force a revision. A result can support, weaken, or fail to distinguish explanations.</p>
      <form className="investigation-form" onSubmit={addInvestigation}>
        <label>QUESTION / WHAT ARE YOU TRYING TO EXPLAIN?<input value={testDraft.question} onChange={e=>setTestDraft({...testDraft,question:e.target.value})} required placeholder="What changed, and what might explain it?"/></label>
        <label>OBSERVATION / WHAT WAS ACTUALLY SEEN?<textarea value={testDraft.observation} onChange={e=>setTestDraft({...testDraft,observation:e.target.value})} required rows="2" placeholder="Record the source, conditions, and what was directly observed."/></label>
        <div className="investigation-two"><label>HYPOTHESIS / ONE POSSIBLE EXPLANATION<textarea value={testDraft.interpretation} onChange={e=>setTestDraft({...testDraft,interpretation:e.target.value})} rows="2" placeholder="If this explanation is right…"/></label><label>ALTERNATIVE / WHAT ELSE COULD EXPLAIN IT?<textarea value={testDraft.alternative} onChange={e=>setTestDraft({...testDraft,alternative:e.target.value})} rows="2" placeholder="Keep a competing model alive."/></label></div>
        <div className="investigation-two"><label>PREDICTION / WHAT SHOULD HAPPEN NEXT?<textarea value={testDraft.prediction} onChange={e=>setTestDraft({...testDraft,prediction:e.target.value})} required rows="2" placeholder="A result that could be observed or measured."/></label><label>FALSIFIER / WHAT WOULD WEAKEN OR REFUTE IT?<textarea value={testDraft.falsifier} onChange={e=>setTestDraft({...testDraft,falsifier:e.target.value})} required rows="2" placeholder="State the result that would count against this model."/></label></div>
        <div className="form-bottom"><button type="submit">SAVE INVESTIGATION +</button><span className="small-status" role="status" aria-live="polite">{testStatus}</span></div>
      </form>
      <div className="investigation-list">
        {investigations.length===0?<p className="empty-investigation">No investigations saved yet. The first one should be specific enough to fail.</p>:investigations.map((item,index)=><article className="investigation-record" key={item.id}>
          <header><span>CASE {String(investigations.length-index).padStart(3,'0')} / {new Date(item.createdAt).toLocaleDateString()}</span><button type="button" onClick={()=>setExpandedTest(expandedTest===item.id?'':item.id)}>{expandedTest===item.id?'CLOSE':'OPEN RECORD'}</button></header>
          <h3>{item.question}</h3><p><b>Observation:</b> {item.observation}</p><p><b>Hypothesis:</b> {item.interpretation||'Not specified'}</p><p><b>Alternative:</b> {item.alternative||'Not specified'}</p><p><b>Prediction:</b> {item.prediction}</p><p><b>Falsifier:</b> {item.falsifier}</p>
          {expandedTest===item.id&&<div className="test-result-editor"><label>OBSERVED RESULT<textarea value={item.result||''} onChange={e=>updateInvestigation(item.id,{result:e.target.value})} rows="2" placeholder="What happened when the test was run? Include the actual measurement and conditions."/></label><label>ASSESSMENT<select aria-label="Investigation assessment" value={item.status||'untested'} onChange={e=>updateInvestigation(item.id,{status:e.target.value})}><option value="untested">Not tested yet</option><option value="supports">Supports this prediction</option><option value="weakens">Weakens this explanation</option><option value="inconclusive">Inconclusive / cannot distinguish</option></select></label><button type="button" onClick={()=>removeInvestigation(item.id)}>DELETE RECORD</button></div>}
          <footer><span className={'test-status '+(item.status||'untested')}>{(item.status||'untested').toUpperCase()}</span><small>{item.updatedAt?'UPDATED '+new Date(item.updatedAt).toLocaleString():'ORIGINAL ENTRY'}</small></footer>
        </article>)}
      </div>
      <p className="truth-note">A connection is a lead, not a verdict. This notebook records your reasoning; it does not independently validate scientific or medical claims.</p>
    </section>

    <section className="country-return">
      <div className="section-scribble"><span>04 / THE WAY BACK</span><span>THE ARTWORK DOES NOT GET TO KEEP YOU</span></div>
      <div className="return-card"><div><p className="ink-label">A QUIETER DESK / PRESENT-TENSE CARE</p><h2>Leave the map.<br/><i>Keep your feet.</i></h2><p>When the field feels too loud, stop interpreting. Notice the room you are in, lower stimulation if that helps, and contact someone you trust. If unusual perceptions, fear, confusion, or disrupted sleep are affecting safety or daily life, a qualified health professional can help assess possible causes. You do not have to solve it inside an artwork.</p></div><button type="button" onClick={()=>setHealthOpen(!healthOpen)}>{healthOpen?'CLOSE THE HEALTH DESK':'OPEN THE HEALTH DESK ↗'}</button></div>
      {healthOpen&&<div className="health-desk"><h3>Health desk / plain language only</h3><ul><li>Record what happened, when it began, sleep changes, medicines or substances, and what helps or worsens it.</li><li>Bring the record to a licensed clinician. Ask about medical, medication, sleep, and mental-health explanations without presuming one.</li><li>If there is immediate danger, inability to care for basic needs, or risk of harm, seek urgent in-person help or emergency services.</li></ul><a href="https://www.nimh.nih.gov/health/topics/psychosis" target="_blank" rel="noreferrer">NIMH: understanding psychosis ↗</a></div>}
    </section>

    <footer className="country-footer"><span>THE COUNTRY REMAINS OPEN.</span><button type="button" onClick={exportNotebook}>EXPORT NOTES + INVESTIGATIONS ↓</button><a href="./?view=workshop">BACK TO THE WORKSHOP ↑</a></footer>
  </main>;
}
