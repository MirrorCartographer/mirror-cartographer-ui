import React, { useEffect, useMemo, useRef, useState } from 'react';
import './LivingWorld.css';

const MEMORY_KEY = 'mc-living-world-visitor-v1';
const EVENTS = [
  { id:'bell', line:'The bell rang thirteen times. I counted. I always count.', cue:'A thirteenth light is burning in the tower.', mood:'bell' },
  { id:'moth', line:'Something has been eating the labels off the specimens. Honestly, fair.', cue:'The greenhouse has started growing little paper tags.', mood:'garden' },
  { id:'train', line:'The night train arrived with no passengers. It left with one extra shadow.', cue:'There is a new shadow on the platform.', mood:'train' },
  { id:'clock', line:'I fixed the clock. It now tells the truth. Nobody likes it.', cue:'Every clock in the station is showing a different hour.', mood:'clock' },
  { id:'music', line:'Someone is playing the song from the room that burned down. The room is still there, by the way.', cue:'A melody is leaking through the floorboards.', mood:'music' },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const makeVisitorId = () => {
  try { return window.crypto?.randomUUID?.() || `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
  catch { return `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
};
const visitorSeed = (id = '') => [...id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);

function readMemory() {
  try {
    const value = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
    return {
      visitorId: typeof value.visitorId === 'string' && value.visitorId.length >= 8 ? value.visitorId : makeVisitorId(),
      visits: Number.isFinite(value.visits) ? clamp(value.visits, 0, 100000) : 0,
      trust: Number.isFinite(value.trust) ? clamp(value.trust, 0, 8) : 0,
      choices: Array.isArray(value.choices) ? value.choices.slice(-12) : [],
      lastEvent: typeof value.lastEvent === 'string' ? value.lastEvent : '',
    };
  } catch { return { visitorId:makeVisitorId(), visits:0, trust:0, choices:[], lastEvent:'' }; }
}

function Morrow({ mood, onClick, noticed }) {
  return <button className={`morrow ${mood}`} onClick={onClick} aria-label="Talk to Morrow, the station keeper">
    <span className="morrow-shadow" />
    <svg className="morrow-art" viewBox="0 0 250 340" role="img" aria-label="Morrow, a small moth-like station keeper in an oversized coat">
      <defs>
        <linearGradient id="m-coat" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5c3445"/><stop offset=".55" stopColor="#29252e"/><stop offset="1" stopColor="#11151b"/></linearGradient>
        <linearGradient id="m-wing" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e8cfa0" stopOpacity=".92"/><stop offset=".52" stopColor="#b98c9b" stopOpacity=".62"/><stop offset="1" stopColor="#758e85" stopOpacity=".15"/></linearGradient>
        <radialGradient id="m-face"><stop stopColor="#f3dfbd"/><stop offset="1" stopColor="#a98a76"/></radialGradient>
        <filter id="m-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g className="morrow-wings" fill="url(#m-wing)" stroke="#e8d3b5" strokeOpacity=".75" strokeWidth="1.5">
        <path d="M108 130C52 32 8 45 20 124c7 47 48 79 94 80Z"/><path d="M142 130c56-98 100-85 88-6-7 47-48 79-94 80Z"/>
        <path d="M104 163C42 135 24 173 52 211c18 24 43 24 61 9Z" opacity=".7"/><path d="M146 163c62-28 80 10 52 48-18 24-43 24-61 9Z" opacity=".7"/>
        <path d="M30 84q38 8 67 64M219 84q-38 8-67 64M48 184q30-20 58-13M202 184q-30-20-58-13" fill="none" stroke="#6e5b61" strokeOpacity=".7"/>
      </g>
      <g className="morrow-antennae" fill="none" stroke="#d9c39f" strokeWidth="3" strokeLinecap="round"><path d="M111 83Q78 25 61 42"/><path d="M139 83q33-58 50-41"/></g>
      <ellipse cx="125" cy="125" rx="49" ry="52" fill="url(#m-face)" stroke="#ead9bd" strokeWidth="2"/>
      <path d="M79 117q4-51 46-49 44-1 48 49-22-20-47-18-24-2-47 18" fill="#342833"/>
      <g className="morrow-eyes" fill="#17151a" filter="url(#m-glow)"><ellipse cx="108" cy="126" rx="6" ry="10"/><ellipse cx="143" cy="126" rx="6" ry="10"/></g>
      <g className="morrow-blush" fill="#a66d71" opacity=".48"><ellipse cx="94" cy="143" rx="10" ry="5"/><ellipse cx="156" cy="143" rx="10" ry="5"/></g>
      <path d="M119 151q7 6 14 0" fill="none" stroke="#66464a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M83 174q42-19 84 0l25 128q-66 36-134 0Z" fill="url(#m-coat)" stroke="#d0b28b" strokeWidth="2"/>
      <path d="M125 173v127m-23-112 23 24 23-24" fill="none" stroke="#d7bd96" strokeWidth="2"/>
      <path d="M83 188 48 266q-3 11 9 14l47-61m63-31 35 78q3 11-9 14l-47-61" fill="none" stroke="#b98e79" strokeWidth="15" strokeLinecap="round"/>
      <path d="M99 298q-21 17-35 21m87-21q21 17 35 21" fill="none" stroke="#18161d" strokeWidth="15" strokeLinecap="round"/>
      <path d="M105 190q20 18 40 0" fill="none" stroke="#ead8b7" strokeWidth="1.5"/>
      <circle cx="125" cy="222" r="5" fill="#e5c68d"/><circle cx="125" cy="249" r="4" fill="#e5c68d"/>
      <path d="M94 183q-20 45-8 87m70-87q20 45 8 87" fill="none" stroke="#8f6670" strokeWidth="2" opacity=".8"/>
      <g className="morrow-lantern" transform="translate(187 228)"><path d="M0 0v20" stroke="#d9c39f" strokeWidth="2"/><path d="M-10 20h20l-3 24h-14Z" fill="#d5a96c" stroke="#f3d6a5"/><ellipse cx="0" cy="31" rx="8" ry="10" fill="#ffe7a9" opacity=".9" filter="url(#m-glow)"/></g>
    </svg>
    {noticed && <span className="morrow-notice">you again.</span>}
    <span className="morrow-name">MORROW <i>· station keeper</i></span>
  </button>;
}


function Vesper({ onClick }) {
  return <button className="vesper" onClick={onClick} aria-label="Talk to Vesper, the station cat">
    <span className="vesper-tail"/><span className="vesper-body"/><span className="vesper-head"/><i className="vesper-ear ear-left"/><i className="vesper-ear ear-right"/><i className="vesper-eye eye-left"/><i className="vesper-eye eye-right"/><span className="vesper-bell"/>
  </button>;
}

function WorldScene({ event, onTalk, onVesper, onDoor, visits, presence, onPresence }) {
  const trackPresence = (pointerEvent) => {
    const rect = pointerEvent.currentTarget.getBoundingClientRect();
    const x = clamp((pointerEvent.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((pointerEvent.clientY - rect.top) / rect.height, 0, 1);
    pointerEvent.currentTarget.style.setProperty('--field-x', `${x * 100}%`);
    pointerEvent.currentTarget.style.setProperty('--field-y', `${y * 100}%`);
    pointerEvent.currentTarget.style.setProperty('--gaze-x', `${clamp((x - 0.5) * 7, -3.5, 3.5)}px`);
    pointerEvent.currentTarget.style.setProperty('--gaze-y', `${clamp((y - 0.5) * 5, -2.5, 2.5)}px`);
    const nearMorrow = x > 0.34 && x < 0.66 && y > 0.42;
    const nearVesper = x > 0.66 && y > 0.5;
    onPresence(nearMorrow ? 'morrow-near' : nearVesper ? 'vesper-near' : 'nearby');
  };
  return <div className={`living-scene mood-${event.mood} presence-${presence}`} onPointerMove={trackPresence} onPointerLeave={() => onPresence('away')}>
    <div className="scene-sky"><div className="moon"><i/></div><div className="cloud cloud-a"/><div className="cloud cloud-b"/><div className="sky-grain"/></div>
    <div className="distant-city"><i/><i/><i/><i/><i/><i/></div>
    <div className="glasshouse"><div className="glasshouse-roof"/><div className="glasshouse-frame"/><div className="glasshouse-glow"/><div className="glasshouse-plants"><i/><i/><i/><i/><i/></div></div>
    <div className="clocktower"><div className="tower-roof"/><div className="tower-face"><b/><i/></div><div className="tower-window"/></div>
    <div className="station"><div className="station-roof"/><div className="station-sign">THE BETWEEN</div><div className="station-window"><i/><i/><i/></div><div className="station-door"><span>?</span></div><div className="station-lamp"/></div>
    <div className="platform"><div className="rail rail-one"/><div className="rail rail-two"/><div className="platform-crack"/></div>
    <div className="foreground-plant plant-left"><i/><i/><i/><i/></div><div className="foreground-plant plant-right"><i/><i/><i/></div>
    <div className="floating-specimens"><i/><i/><i/><i/><i/></div>
    <div className="scene-signals" aria-hidden="true"><span>FIELD NOTE 0{visits + 1}</span><span>THE NIGHT IS IN PROGRESS</span></div>
    <Morrow mood={event.mood} onClick={onTalk} noticed={visits > 0}/><Vesper onClick={onVesper}/>
    <button className="door-invitation" onClick={onDoor}><span>THE DOOR ISN'T LOCKED</span><b>↗</b></button>
  </div>;
}

export default function LivingWorld() {
  const [memory, setMemory] = useState(readMemory);
  const [eventIndex, setEventIndex] = useState(0);
  const [presence, setPresence] = useState('arrived');
  const presenceTimerRef = useRef(null);
  const visitRecordedRef = useRef(false);
  const autoNoticeRef = useRef({ morrow:false, vesper:false });
  const [dialogue, setDialogue] = useState('');
  const [chapter, setChapter] = useState(0);
  const [speaker, setSpeaker] = useState('MORROW');
  const [ambient, setAmbient] = useState(false);
  const audioRef = useRef(null);
  const event = EVENTS[eventIndex];
  const line = useMemo(() => {
    if (dialogue) return dialogue;
    if (memory.visits > 1 && memory.choices.includes('asked-about-world')) return 'You came back to ask what this place is. I have made absolutely no progress. Welcome back.';
    if (memory.visits > 1 && memory.choices.includes('opened-the-door')) return 'You came back from the other side. I was going to ask what you saw, but you look tired.';
    if (memory.visits > 0 && memory.trust > 2) return 'You came back. I was beginning to think you had better places to be.';
    if (memory.visits > 0) return 'Oh. It’s you. I kept your place. Don’t make it sentimental.';
    return event.line;
  }, [dialogue, memory, event]);
  useEffect(() => {
    const seed = visitorSeed(memory.visitorId);
    setEventIndex((seed + memory.visits) % EVENTS.length);
    if (!visitRecordedRef.current) {
      visitRecordedRef.current = true;
      const next = { ...memory, visits: memory.visits + 1 };
      setMemory(next);
      try { localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch {}
    }
    const timer = window.setInterval(() => setEventIndex((value) => (value + 1) % EVENTS.length), 42000);
    return () => { window.clearInterval(timer); window.clearTimeout(presenceTimerRef.current); if (audioRef.current) audioRef.current.close().catch(() => {}); };
    // A visit is counted once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (dialogue) return;
    if (presence === 'morrow-near' && !autoNoticeRef.current.morrow) {
      autoNoticeRef.current.morrow = true;
      setSpeaker('MORROW');
      setDialogue('You can look, you know. I am not a display.');
    } else if (presence === 'vesper-near' && !autoNoticeRef.current.vesper) {
      autoNoticeRef.current.vesper = true;
      setSpeaker('VESPER');
      setDialogue('I saw you looking. I am deciding whether to be offended.');
    }
  }, [presence, dialogue]);
  const updatePresence = (nextPresence) => {
    window.clearTimeout(presenceTimerRef.current);
    setPresence(nextPresence);
    if (['nearby', 'morrow-near', 'vesper-near'].includes(nextPresence)) {
      presenceTimerRef.current = window.setTimeout(() => setPresence('still'), 2600);
    } else if (nextPresence === 'away') {
      presenceTimerRef.current = window.setTimeout(() => setPresence('away'), 1200);
    }
  };
  const remember = (choice, reply, trust = 1) => {
    setSpeaker('MORROW');
    const next = { ...memory, trust: clamp(memory.trust + trust, 0, 8), choices: [...memory.choices, choice].slice(-12), lastEvent: event.id };
    setMemory(next);
    setDialogue(reply);
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(next)); } catch {}
  };
  const toggleSound = async () => {
    if (ambient && audioRef.current) {
      const context = audioRef.current; audioRef.current = null; setAmbient(false);
      try { await context.close(); } catch {}
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass(); await context.resume();
      const master = context.createGain(); const filter = context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 420; master.gain.value = 0.0001;
      filter.connect(master).connect(context.destination);
      [55, 82.41, 110].forEach((frequency, index) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.type = index === 1 ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
        oscillator.detune.value = index === 2 ? 7 : -4; gain.gain.value = index === 0 ? 0.42 : 0.17;
        oscillator.connect(gain).connect(filter); oscillator.start();
      });
      master.gain.setTargetAtTime(0.055, context.currentTime, 1.4); audioRef.current = context; setAmbient(true);
    } catch { setAmbient(false); }
  };
  const talkToVesper = () => { setSpeaker('VESPER'); setDialogue('I live under the timetable. It is warmer there. Morrow says I am not supposed to eat the tickets.'); };
  const talk = () => {
    setSpeaker('MORROW');
    setDialogue('');
    setChapter((value) => value + 1);
    setAmbient(false);
  };
  const openDoor = () => {
    remember('opened-the-door', 'Good. I was getting tired of pretending this was a waiting room.', 1);
    setTimeout(() => { window.location.href = './atlas/'; }, 1800);
  };
  return <main className="living-world">
    <WorldScene event={event} onTalk={talk} onVesper={talkToVesper} onDoor={openDoor} visits={memory.visits} presence={presence} onPresence={updatePresence}/>
    <div className="world-vignette"/>
    <header className="world-topbar"><a href="./" className="world-wordmark">MIRROR CARTOGRAPHER <span>· A WORLD IN PROGRESS</span></a><nav><a href="./atlas/">THE ATLAS</a><a href="./?view=workshop">THE WORKSHOP</a><button onClick={toggleSound} aria-pressed={ambient}>{ambient ? 'SOUND OFF' : 'SOUND ON'}</button><a href="./?view=field">THE FIELD</a></nav></header>
    <section className="world-intro"><p>THE BETWEEN / NIGHT SHIFT</p><h1>Somewhere,<br/><em>something is happening.</em></h1><span>{event.cue}</span></section>
    <section className="morrow-dialogue" aria-live="polite"><p className="dialogue-name">{speaker} <i>resident of the station</i></p><p className="dialogue-line">“{line}”</p>
      {dialogue ? <div className="dialogue-choices"><button onClick={() => remember('asked-why', 'Because the station keeps receiving things nobody sent. I sort them. Badly, on purpose.', 1)}>Why are you here?</button><button onClick={() => remember('asked-about-world', 'It’s a place made of unfinished business. Some of it is yours. Most of it isn’t.', 1)}>What is this place?</button><button onClick={() => setDialogue('')}>I should look around.</button></div> : <div className="dialogue-choices"><button onClick={() => remember('asked-event', 'I noticed it before you did. That is not a competition. Yet.', 1)}>What happened?</button><button onClick={() => remember('asked-morrow', 'I keep the doors from getting ideas. They are very ambitious doors.', 1)}>Who are you?</button><button onClick={() => remember('left-silence', '…Good. Silence is underrated.', 0)}>Just listening.</button></div>}
    </section>
    <footer className="world-footer"><span>VISITOR RECORD {String(memory.visits).padStart(3,'0')} · {memory.choices.length} THINGS REMEMBERED</span><span>THE NIGHT SHIFT CONTINUES WHILE YOU ARE HERE.</span></footer>
  </main>;
}
