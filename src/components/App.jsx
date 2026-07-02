import React, { useEffect, useMemo, useState } from 'react';
import archiveManifest from '../data/mcArchiveManifest.json';

const STORAGE_KEY = 'mirror.cartographer.labyrinth.v1';

const chambers = [
  { id: 'threshold', glyph: '✶', title: 'The Threshold', subtitle: 'entry is a change in attention', text: 'The first room does not ask for a task. It asks for orientation: a symbol, a mood, a pressure, a fragment, a doorway. The map begins where ordinary pages stop.', sigil: 'eye / light / door', prompt: 'What symbol is standing in the doorway today?' },
  { id: 'mirror', glyph: '◌', title: 'The Mirror Hall', subtitle: 'symbolism is the engine', text: 'A mirror does not replace the person looking. It returns echo, distortion, recurrence, contradiction, and the bright detail that keeps appearing until it becomes a coordinate.', sigil: 'reflection / recursion / return', prompt: 'What keeps coming back?' },
  { id: 'body', glyph: '☿', title: 'The Body Cloister', subtitle: 'sensation becomes location', text: 'Sensation is kept as map-data before interpretation. Heat, weight, motion, fatigue, and attention become coordinates in the room rather than noise.', sigil: 'chest / eye / foot / breath', prompt: 'Where is the signal located?' },
  { id: 'animals', glyph: '♢', title: 'The Guardian Kennel', subtitle: 'living anchors hold the map', text: 'Bugsy, O’Malley, Griffey, and Nimbus are not side notes. They are part of the field: care, timing, memory, urgency, love, and practical next steps.', sigil: 'Bugsy / O’Malley / Griffey / Nimbus', prompt: 'Which living anchor matters first?' },
  { id: 'proof', glyph: '△', title: 'The Evidence Chapel', subtitle: 'symbols and facts need different labels', text: 'Every claim receives a kind: fact, inference, action, symbolic hypothesis, aesthetic truth, or unanswered question. The symbolic and the scientific stop fighting and start sorting.', sigil: 'claim / source / boundary', prompt: 'What would make this stronger or real?' },
  { id: 'forge', glyph: '☼', title: 'The Artifact Forge', subtitle: 'the maze should make something', text: 'A mapped signal can become a page, packet, film, report, glyph, ritual, offer, or tool. The output has to carry structure and atmosphere at the same time.', sigil: 'page / packet / film / offer', prompt: 'What artifact should this become?' },
  { id: 'home', glyph: '⌂', title: 'The House Beyond', subtitle: 'the final room is safe life', text: 'The map points toward a real outside: animals cared for, money that holds, travel, ocean light, a livable home, and a mind that does not have to cut off its symbols to be understood.', sigil: 'van / ocean / animal sleep / sanctuary', prompt: 'What would make the world feel inhabitable?' },
];

const correspondences = [
  ['eye', 'attention, witness, lighthouse, proof'],
  ['light', 'orientation, exposure, revelation'],
  ['chair / Char', 'self-position, rest, object becoming name'],
  ['Bugsy', 'guardian signal, urgency, love with a pulse'],
  ['labyrinth', 'not lost: patterned wandering with a center'],
  ['serif', 'manuscript, gravity, old book, serious spell'],
  ['threshold', 'where ordinary interface turns ritual'],
  ['mirror', 'return without erasure; seeing the pattern twice'],
];

const proofKinds = ['seed', 'symbol', 'inference', 'action', 'artifact'];

function readState() {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveState(value) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
function classifyEntry(entry) {
  const text = entry.toLowerCase();
  const weighted = chambers.map((room) => {
    const words = `${room.title} ${room.subtitle} ${room.text} ${room.sigil}`.toLowerCase().split(/[^a-z0-9’]+/).filter((word) => word.length > 3);
    const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    return { ...room, score };
  }).sort((a, b) => b.score - a.score);
  return weighted[0]?.score ? weighted[0] : chambers[1];
}

function LabyrinthMark({ active, setActive }) {
  return (
    <section className="labyrinth-mark" aria-label="Interactive Mirror Cartographer labyrinth">
      <div className="maze-lines" />
      <div className="maze-center"><span>MC</span><small>{active.title}</small></div>
      {chambers.map((room, index) => {
        const angle = (index / chambers.length) * Math.PI * 2 - Math.PI / 2;
        const radius = index % 2 === 0 ? 39 : 31;
        const left = 50 + Math.cos(angle) * radius;
        const top = 50 + Math.sin(angle) * radius;
        return <button key={room.id} className={`maze-room ${active.id === room.id ? 'active' : ''}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => setActive(room)} aria-label={`Open ${room.title}`}><span>{room.glyph}</span><em>{room.title.replace('The ', '')}</em></button>;
      })}
    </section>
  );
}

function ChamberPanel({ active, entry, setEntry, setActive }) {
  const routed = useMemo(() => classifyEntry(entry), [entry]);
  const kind = proofKinds[Math.min(proofKinds.length - 1, Math.floor(entry.trim().length / 38))];
  return (
    <section className="chamber-panel">
      <p className="overline">current chamber</p>
      <h2><span>{active.glyph}</span>{active.title}</h2>
      <p className="subtitle">{active.subtitle}</p>
      <p>{active.text}</p>
      <dl className="sigil-list"><div><dt>sigil</dt><dd>{active.sigil}</dd></div><div><dt>question</dt><dd>{active.prompt}</dd></div><div><dt>archive mass</dt><dd>{archiveManifest.conversationCount} conversations held as substrate</dd></div></dl>
      <div className="entry-box"><label htmlFor="entry">write into the maze</label><textarea id="entry" value={entry} onChange={(event) => setEntry(event.target.value)} /></div>
      <div className="route-card"><p className="overline">the maze hears this as</p><strong>{routed.glyph} {routed.title}</strong><span>current form: {kind}</span><button onClick={() => setActive(routed)}>walk there</button></div>
    </section>
  );
}

function CorrespondenceIndex() {
  return <section className="index-panel"><p className="overline">correspondence index</p><h2>Symbols have jobs.</h2><div className="correspondence-grid">{correspondences.map(([symbol, meaning]) => <article key={symbol}><h3>{symbol}</h3><p>{meaning}</p></article>)}</div></section>;
}
function PassageStrip({ setActive }) {
  return <nav className="passage-strip" aria-label="Labyrinth passages">{chambers.map((room) => <button key={room.id} onClick={() => setActive(room)}><span>{room.glyph}</span>{room.title.replace('The ', '')}</button>)}</nav>;
}

function App() {
  const saved = typeof window !== 'undefined' ? readState() : null;
  const [active, setActive] = useState(chambers.find((room) => room.id === saved?.activeId) || chambers[0]);
  const [entry, setEntry] = useState(saved?.entry || 'Eye. Light. Chair became Char. Bugsy is the guardian. Make the site feel like a labyrinth, not a dashboard.');
  useEffect(() => { saveState({ activeId: active.id, entry }); }, [active, entry]);
  return (
    <main className="site-shell">
      <style>{styles}</style><div className="paper-grain" />
      <header className="site-header"><p className="seal">✶ ◌ △ ♢ ☼</p><h1>Mirror Cartographer</h1><p className="thesis">A symbolic labyrinth for turning sensation, animal urgency, memory, contradiction, and proof into navigable form.</p></header>
      <PassageStrip setActive={setActive} />
      <section className="main-grid"><LabyrinthMark active={active} setActive={setActive} /><ChamberPanel active={active} entry={entry} setEntry={setEntry} setActive={setActive} /></section>
      <CorrespondenceIndex />
      <footer className="footer-inscription"><span>not a dashboard</span><span>not a mood board</span><span>a symbolic instrument</span><span>evidence boundaries intact</span></footer>
    </main>
  );
}

const styles = `
:root{color-scheme:dark;--ink:#f6ead7;--dim:#cbbda7;--muted:#9d8d76;--black:#080604;--panel:rgba(34,24,17,.72);--line:rgba(246,234,215,.2);--line2:rgba(216,180,105,.38);--gold:#d8b469;--rose:#b86f6f;--blue:#8fb9c9}*{box-sizing:border-box}html,body,#root{min-height:100%}body{margin:0;background:var(--black);color:var(--ink);font-family:Georgia,'Times New Roman',serif}button,textarea{font:inherit}button{cursor:pointer;color:inherit}.site-shell{min-height:100vh;position:relative;overflow:hidden;padding:28px;background:radial-gradient(circle at 50% 18%,rgba(184,111,111,.18),transparent 28%),radial-gradient(circle at 18% 70%,rgba(143,185,201,.12),transparent 30%),linear-gradient(135deg,#090604,#17100c 45%,#040302)}.paper-grain{position:fixed;inset:0;pointer-events:none;opacity:.34;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),radial-gradient(circle at center,transparent,rgba(0,0,0,.72));background-size:34px 34px,34px 34px,100% 100%;mix-blend-mode:screen}.site-header{max-width:1320px;margin:0 auto 20px;text-align:center;position:relative}.seal{letter-spacing:.9em;color:var(--gold);font-size:.85rem;margin:0 0 14px;text-indent:.9em}.site-header h1{font-size:clamp(4.4rem,13vw,12.5rem);line-height:.72;margin:0;letter-spacing:-.085em;font-weight:500;text-shadow:0 0 34px rgba(216,180,105,.16)}.thesis{max-width:780px;margin:22px auto 0;color:var(--dim);font-size:clamp(1.05rem,2.2vw,1.45rem);line-height:1.45}.passage-strip{max-width:1320px;margin:22px auto;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.passage-strip button{border:1px solid var(--line);border-radius:999px;background:rgba(246,234,215,.045);padding:9px 13px;color:var(--dim);box-shadow:inset 0 0 18px rgba(216,180,105,.03)}.passage-strip span{color:var(--gold);margin-right:7px}.passage-strip button:hover{border-color:var(--line2);color:var(--ink);background:rgba(216,180,105,.09)}.main-grid{max-width:1320px;margin:0 auto;display:grid;grid-template-columns:minmax(360px,.92fr) minmax(0,1.08fr);gap:22px;align-items:stretch}.labyrinth-mark{min-height:680px;border:1px solid var(--line2);border-radius:42px;position:relative;background:radial-gradient(circle at center,rgba(216,180,105,.11),transparent 24%),linear-gradient(135deg,rgba(246,234,215,.07),rgba(246,234,215,.025));box-shadow:0 40px 140px rgba(0,0,0,.42),inset 0 0 90px rgba(0,0,0,.35);overflow:hidden}.maze-lines{position:absolute;inset:8%;border:2px solid rgba(216,180,105,.5);border-radius:50%;box-shadow:0 0 0 42px rgba(216,180,105,.025),0 0 0 84px rgba(246,234,215,.025),0 0 0 126px rgba(216,180,105,.018)}.maze-lines:before,.maze-lines:after{content:'';position:absolute;inset:12%;border:1px solid rgba(246,234,215,.22);border-radius:24% 50% 35% 48%;transform:rotate(38deg)}.maze-lines:after{inset:26%;border-color:rgba(143,185,201,.2);transform:rotate(-28deg);border-radius:50% 28% 48% 34%}.maze-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:176px;height:176px;border:1px solid var(--line2);border-radius:50%;display:grid;place-items:center;text-align:center;background:rgba(8,6,4,.82);box-shadow:0 0 70px rgba(216,180,105,.2),inset 0 0 38px rgba(246,234,215,.04);padding:22px}.maze-center span{font-size:4rem;line-height:.8;letter-spacing:-.14em}.maze-center small{display:block;color:var(--dim);font-style:italic;line-height:1.15}.maze-room{position:absolute;transform:translate(-50%,-50%);width:118px;min-height:88px;border:1px solid rgba(246,234,215,.22);border-radius:60px 60px 16px 16px;background:rgba(20,13,9,.78);display:grid;place-items:center;padding:10px;box-shadow:0 18px 50px rgba(0,0,0,.35);transition:transform .25s ease,border-color .25s ease,background .25s ease}.maze-room span{font-size:1.55rem;color:var(--gold)}.maze-room em{font-size:.78rem;color:var(--dim);font-style:italic;text-align:center}.maze-room:hover,.maze-room.active{transform:translate(-50%,-50%) scale(1.06);border-color:var(--gold);background:rgba(68,43,25,.9)}.maze-room.active:after{content:'';position:absolute;inset:-9px;border:1px solid rgba(216,180,105,.36);border-radius:inherit}.chamber-panel,.index-panel{border:1px solid var(--line);border-radius:42px;background:linear-gradient(145deg,var(--panel),rgba(12,8,5,.76));box-shadow:0 30px 110px rgba(0,0,0,.38);padding:30px;position:relative;overflow:hidden}.chamber-panel:before,.index-panel:before{content:'';position:absolute;inset:14px;border:1px solid rgba(246,234,215,.08);border-radius:32px;pointer-events:none}.overline{text-transform:uppercase;letter-spacing:.26em;color:var(--gold);font-size:.72rem;margin:0 0 12px;font-family:ui-sans-serif,system-ui,sans-serif;font-weight:800}.chamber-panel h2,.index-panel h2{font-weight:500;font-size:clamp(2.5rem,6vw,5.8rem);line-height:.82;letter-spacing:-.06em;margin:0 0 16px}.chamber-panel h2 span{color:var(--gold);margin-right:14px}.subtitle{font-size:1.35rem;color:var(--blue);font-style:italic;margin:0 0 18px}.chamber-panel p,.index-panel p{color:var(--dim);line-height:1.62;font-size:1.04rem}.sigil-list{display:grid;gap:10px;margin:22px 0}.sigil-list div{border-top:1px solid rgba(246,234,215,.12);padding-top:10px;display:grid;grid-template-columns:130px 1fr;gap:12px}.sigil-list dt{text-transform:uppercase;letter-spacing:.18em;color:var(--muted);font-size:.72rem;font-family:ui-sans-serif,system-ui,sans-serif}.sigil-list dd{margin:0;color:var(--ink)}.entry-box{margin-top:22px}.entry-box label{display:block;color:var(--gold);font-style:italic;margin-bottom:8px}textarea{width:100%;min-height:150px;border:1px solid rgba(246,234,215,.18);border-radius:24px;background:rgba(5,3,2,.66);color:var(--ink);padding:18px;resize:vertical;outline:none;line-height:1.45}textarea:focus{border-color:var(--gold);box-shadow:0 0 0 4px rgba(216,180,105,.11)}.route-card{margin-top:14px;border:1px solid rgba(216,180,105,.28);border-radius:24px;padding:16px;background:rgba(216,180,105,.07)}.route-card strong,.route-card span{display:block}.route-card strong{font-size:1.35rem;font-weight:500}.route-card span{color:var(--dim);margin:4px 0 12px}.route-card button{border:1px solid var(--line2);border-radius:999px;background:rgba(216,180,105,.1);padding:9px 13px}.index-panel{max-width:1320px;margin:22px auto 0}.correspondence-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:20px}.correspondence-grid article{border:1px solid rgba(246,234,215,.14);border-radius:24px;padding:16px;background:rgba(246,234,215,.045)}.correspondence-grid h3{font-size:1.4rem;font-weight:500;margin:0 0 8px;color:var(--ink)}.correspondence-grid p{font-size:.96rem;margin:0}.footer-inscription{max-width:1320px;margin:18px auto 0;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;color:var(--muted);font-family:ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:.68rem}.footer-inscription span{border:1px solid rgba(246,234,215,.12);border-radius:999px;padding:8px 10px;background:rgba(246,234,215,.035)}@media(max-width:980px){.site-shell{padding:16px}.main-grid{grid-template-columns:1fr}.labyrinth-mark{min-height:560px}.site-header h1{font-size:clamp(3.4rem,18vw,7rem)}.correspondence-grid{grid-template-columns:1fr 1fr}.sigil-list div{grid-template-columns:1fr}.maze-room{width:94px;min-height:74px}.maze-center{width:142px;height:142px}.maze-center span{font-size:3rem}}@media(max-width:560px){.correspondence-grid{grid-template-columns:1fr}.labyrinth-mark{min-height:500px}.maze-room{width:82px;min-height:66px}.maze-room em{font-size:.68rem}.chamber-panel,.index-panel{padding:22px;border-radius:30px}.chamber-panel h2,.index-panel h2{font-size:2.7rem}.seal{letter-spacing:.45em;text-indent:.45em}}
`;

export default App;
