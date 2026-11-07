import React, { useMemo, useState } from 'react';
import './LivingCountry.css';

const KEY = 'mc-living-country-v1';
const seed = [
  { id:'weather', title:'Weather inside a thought', kind:'field note', body:'A feeling can change the whole landscape without changing the facts beneath it.', context:'embodied', x:18, y:24 },
  { id:'echo', title:'The echo that kept returning', kind:'question', body:'What repeats, what changes, and what is only being heard more loudly?', context:'temporal', x:50, y:13 },
  { id:'moss', title:'Moss on the machine', kind:'connection', body:'Living systems and built systems both carry traces of their conditions.', context:'systems', x:78, y:29 },
  { id:'shore', title:'A shoreline is not a border', kind:'hypothesis', body:'Boundaries can be interfaces where exchange happens, not merely walls.', context:'relational', x:30, y:67 },
  { id:'lantern', title:'The lantern test', kind:'experiment', body:'Change one condition. Record what changes and what stays put.', context:'measurement', x:72, y:73 },
];
const contexts = ['embodied','temporal','systems','relational','measurement','language','care'];
const read = () => { try { const v=JSON.parse(localStorage.getItem(KEY)||'null'); return Array.isArray(v)&&v.length?v:seed; } catch { return seed; } };
const uid = () => globalThis.crypto?.randomUUID?.() || 'note-'+Date.now().toString(36);

export default function LivingCountry() {
  const [notes,setNotes] = useState(read);
  const [selected,setSelected] = useState('weather');
  const [context,setContext] = useState('embodied');
  const [draft,setDraft] = useState('');
  const [kind,setKind] = useState('field note');
  const [lens,setLens] = useState('artist');
  const [healthOpen,setHealthOpen] = useState(false);
  const [companion,setCompanion] = useState('O’Malley');
  const [saved,setSaved] = useState(false);
  const current = notes.find(n=>n.id===selected) || notes[0];
  const filtered = useMemo(()=>notes.filter(n=>context==='all'||n.context===context),[notes,context]);
  const persist = next => { setNotes(next); try { localStorage.setItem(KEY,JSON.stringify(next)); setSaved(true); } catch { setSaved(false); } };
  const add = e => { e.preventDefault(); if(!draft.trim()) return; const item={id:uid(),title:draft.trim().split('\n')[0].slice(0,54),body:draft.trim(),kind,context,x:18+Math.random()*64,y:18+Math.random()*64}; persist([item,...notes]); setSelected(item.id); setDraft(''); };
  const remove = id => { const next=notes.filter(n=>n.id!==id); persist(next); setSelected(next[0]?.id||''); };
  return <main className="living-country">
    <header className="country-head"><a href="./">← FIELD ENTRANCE</a><span>FIELD ATLAS / SHEET 07 / HAND-ANNOTATED</span><button onClick={()=>setLens(lens==='artist'?'clinical':'artist')}>LENS: {lens==='artist'?'ARTIST NOTEBOOK':'PLAIN LANGUAGE'}</button></header>
    <section className="country-opening">
      <p className="ink-label">A COUNTRY DRAWN WHILE THE INK WAS STILL WET</p>
      <h1>The Living<br/><i>Country.</i></h1>
      <p className="opening-copy">{lens==='artist'?'A field of signals, scraps, repetitions, bright connections and unfinished maps. Not a diagnosis. Not a maze you must solve. An artwork with doors back out.':'A creative workspace for recording observations, questions, relationships, and testable ideas without treating interpretation as fact.'}</p>
      <div className="opening-stamp">FIELD COPY<br/>NOT A MAP<br/>OF YOU</div>
    </section>
    <section className="pet-marginalia" aria-label="Companion field notes"><span className="ink-label">MARGINALIA / THE CREW</span><div>{[["O’Malley","night archivist"],["Bug","threshold inspector"],["Nimbus","weather watcher"]].map(([name,role])=><button key={name} className={companion===name?"chosen":""} onClick={()=>setCompanion(name)}>{name}<small>{role}</small></button>)}</div><p>{companion==="O’Malley"?"A quiet keeper of the things that would otherwise disappear.":companion==="Bug"?"A small guardian of every doorway, especially the ones that lead home.":"A soft-moving witness to every change in the weather."}</p></section>
    <section className="country-map-section">
      <div className="section-scribble"><span>01 / THE OVERGROWN MAP</span><span>SELECT A MARK. MOVE BETWEEN LENSES.</span></div>
      <div className="country-map" role="group" aria-label="Interactive map of notes">
        <div className="map-grid" aria-hidden="true"/><div className="map-river" aria-hidden="true"/>
        {filtered.map((n,i)=><button key={n.id} className={'map-mark '+(selected===n.id?'chosen':'')} style={{'--mx':n.x+'%','--my':n.y+'%','--tilt':((i%5)-2)*3+'deg'}} onClick={()=>setSelected(n.id)} aria-pressed={selected===n.id}><span>{String(i+1).padStart(2,'0')}</span>{n.title}</button>)}
        <span className="map-coordinate north">N / 04°—INK</span><span className="map-coordinate south">S / THE UNFINISHED EDGE</span>
      </div>
      <div className="map-controls"><label>READ THROUGH <select value={context} onChange={e=>setContext(e.target.value)}><option value="all">All territories</option>{contexts.map(x=><option key={x}>{x}</option>)}</select></label><span>{filtered.length} marks visible · {notes.length} in the notebook</span></div>
      {current&&<article className="selected-fragment"><div><small>{current.kind} / {current.context}</small><h2>{current.title}</h2><p>{current.body}</p></div><div className="fragment-actions"><button onClick={()=>setContext(current.context)}>FOLLOW THIS LENS ↗</button>{!seed.some(n=>n.id===current.id)&&<button onClick={()=>remove(current.id)}>REMOVE NOTE</button>}</div></article>}
    </section>
    <section className="country-workbench">
      <div className="section-scribble"><span>02 / MAKE A MARK</span><span>YOUR NOTES STAY IN THIS BROWSER</span></div>
      <form onSubmit={add} className="country-form"><label>NEW FRAGMENT<textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="A detail, an oddity, a question, a thing you noticed…" required rows="3"/></label><div className="form-bottom"><label>TYPE<select value={kind} onChange={e=>setKind(e.target.value)}>{['field note','question','connection','hypothesis','experiment','contradiction'].map(x=><option key={x}>{x}</option>)}</select></label><label>CONTEXT<select value={context==='all'?'embodied':context} onChange={e=>setContext(e.target.value)}>{contexts.map(x=><option key={x}>{x}</option>)}</select></label><button type="submit">PIN TO THE COUNTRY +</button></div><small aria-live="polite">{saved?'LOCAL NOTE SAVED.':'No account. No upload. Export and sync are not connected.'}</small></form>
    </section>
    <section className="country-investigation">
      <div className="section-scribble"><span>03 / THE INVESTIGATION TABLE</span><span>BEAUTIFUL IS NOT THE SAME AS TRUE</span></div>
      <div className="investigation-grid"><article><b>OBSERVATION</b><p>What did you directly notice? Keep the raw signal intact.</p></article><article><b>INTERPRETATION</b><p>What story might explain it? Keep alternatives alive.</p></article><article><b>PREDICTION</b><p>What should happen if the explanation is right?</p></article><article><b>FALSIFIER</b><p>What result would make you revise or abandon it?</p></article></div>
      <p className="truth-note">A connection is a lead, not a verdict. This room helps organize inquiry; it does not validate scientific or medical claims.</p>
    </section>
    <section className="country-return">
      <div className="section-scribble"><span>04 / THE WAY BACK</span><span>THE ARTWORK DOES NOT GET TO KEEP YOU</span></div>
      <div className="return-card"><div><p className="ink-label">A QUIETER DESK / PRESENT-TENSE CARE</p><h2>Leave the map.<br/><i>Keep your feet.</i></h2><p>When the field feels too loud, stop interpreting. Name what is physically here, lower the stimulation, drink some water if useful, and contact someone you trust. If unusual perceptions, fear, confusion, or sleep disruption are affecting safety or daily life, a qualified health professional can help assess what is happening. You do not have to solve it inside an artwork.</p></div><button onClick={()=>setHealthOpen(!healthOpen)}>{healthOpen?'CLOSE THE HEALTH DESK':'OPEN THE HEALTH DESK ↗'}</button></div>
      {healthOpen&&<div className="health-desk"><h3>Health desk / plain language only</h3><ul><li>Write down what happened, when it began, sleep changes, substances or medicines, and what helps or worsens it.</li><li>Bring the notes to a licensed clinician; ask about medical, medication, sleep, and mental-health explanations without presuming one.</li><li>If there is immediate danger, inability to care for basic needs, or risk of harm, seek urgent in-person help or emergency services.</li></ul><a href="https://www.nimh.nih.gov/health/topics/psychosis" target="_blank" rel="noreferrer">NIMH: understanding psychosis ↗</a></div>}
    </section>
    <footer className="country-footer"><span>THE COUNTRY REMAINS OPEN.</span><span>O’MALLEY / BUG / NIMBUS — THREE SMALL SUPERVISORS OF THE FIELD NOTES.</span><a href="./?view=workshop">BACK TO THE WORKSHOP ↑</a></footer>
  </main>;
}
