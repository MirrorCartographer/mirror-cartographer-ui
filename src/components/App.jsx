import React, { useEffect, useMemo, useRef, useState } from 'react';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

const STATES = {
  dormant: {
    title: 'The page is not waiting for commands. It is waiting for weather.',
    text: 'Begin with permission. After that, the interface listens for atmosphere: brightness, motion, sound pressure, rhythm, stillness, time, and return. Nothing is uploaded. The room becomes the input.',
    body: 'Closed eye. No demand.',
    phase: 'closed eye',
  },
  hush: {
    title: 'The room lowered its voice, so the interface lowers its weight.',
    text: 'Low sound and low motion create a holding state. The page preserves continuity instead of asking for action.',
    body: 'Throat quiet. Feet heavier. Attention can settle.',
    phase: 'holding field',
  },
  flare: {
    title: 'Something entered the field.',
    text: 'Motion and sound rose together. The interface sharpens contrast, anchors the center, and refuses to scatter.',
    body: 'Heart bright. Hands awake. The system braces without panicking.',
    phase: 'entered force',
  },
  lantern: {
    title: 'The light is high; the map becomes outward-facing.',
    text: 'Brightness opens the visual field. The interface makes edges clearer and lets the question travel farther.',
    body: 'Eyes outward. Room visible. Thought can branch.',
    phase: 'outward map',
  },
  cave: {
    title: 'The light fell; the map turns inward.',
    text: 'Dimness reduces demand. The interface becomes slower, larger, and less verbal, because low light asks for fewer sharp edges.',
    body: 'Cave mode. Bigger shapes. Fewer claims.',
    phase: 'inward map',
  },
  pulse: {
    title: 'The page has found a pulse.',
    text: 'Signals are not identical, but they are returning in a recognizable rhythm. That is the beginning of recursive contact.',
    body: 'Return detected. Not meaning yet. Pattern first.',
    phase: 'recursive return',
  },
  storm: {
    title: 'The field is loud enough to simplify.',
    text: 'When intensity rises, the interface does not add complexity. It compresses, centers, and gives the nervous system fewer things to hold.',
    body: 'Sound pressure high. One anchor. One breath.',
    phase: 'compression anchor',
  },
  witness: {
    title: 'The system is watching the loop, not the person.',
    text: 'Human state changes interface. Interface changes human state. The next signal reveals what survived. The loop is the object.',
    body: 'The person is not the target. The relation is the instrument.',
    phase: 'loop witness',
  },
};

function classify(signal, started) {
  if (!started) return 'dormant';
  if (signal.sound > 0.7) return 'storm';
  if (signal.sound > 0.38 && signal.motion > 0.38) return 'flare';
  if (signal.coherence > 0.72 && signal.return > 0.28) return 'pulse';
  if (signal.still > 0.82 && signal.sound < 0.16 && signal.motion < 0.16) return 'hush';
  if (signal.light > 0.68) return 'lantern';
  if (signal.light < 0.24) return 'cave';
  return 'witness';
}

function intentFor(stateName) {
  return {
    dormant: 'The first gesture is consent. The second gesture is atmosphere.',
    hush: 'The best next interaction may be no interaction.',
    flare: 'The field changed quickly. The page compresses toward an anchor.',
    lantern: 'Light invites expansion. The map grows edges.',
    cave: 'Dimness invites fewer words and larger shapes.',
    pulse: 'A return pattern is forming. The loop is becoming visible.',
    storm: 'High intensity detected. Reduce branches. Hold one center.',
    witness: 'The system is not reading you. It is reading the relation.',
  }[stateName];
}

function Metric({ label, value }) {
  return (
    <div>
      <span>{Math.round(clamp(value) * 100)}</span>
      <label>{label}</label>
    </div>
  );
}

function App() {
  const atmosphereRef = useRef(null);
  const constellationRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const historyRef = useRef([]);
  const lastSignatureRef = useRef('');
  const [started, setStarted] = useState(false);
  const [silent, setSilent] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [trace, setTrace] = useState(['Dormant. The room has not been opened.']);
  const [baseline, setBaseline] = useState({ sound: 0.02, motion: 0.02, light: 0.42 });
  const [signal, setSignal] = useState({ sound: 0.02, motion: 0.02, light: 0.42, still: 0.72, coherence: 0.18, return: 0.08 });

  const stateName = useMemo(() => classify(signal, started), [signal, started]);
  const current = STATES[stateName];

  const log = (message) => {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setTrace((items) => [`${stamp} — ${message}`, ...items].slice(0, 12));
  };

  useEffect(() => {
    const atmosphere = atmosphereRef.current;
    const constellation = constellationRef.current;
    if (!atmosphere || !constellation) return;
    const ctx = atmosphere.getContext('2d');
    const starCtx = constellation.getContext('2d');
    let width = 0;
    let height = 0;
    let particles = [];
    let stars = [];

    function resize() {
      width = atmosphere.width = constellation.width = window.innerWidth;
      height = atmosphere.height = constellation.height = window.innerHeight;
      particles = Array.from({ length: 125 }, () => ({ x: Math.random() * width, y: Math.random() * height, a: Math.random() * 6.28 }));
      stars = Array.from({ length: 72 }, () => ({ x: Math.random() * width, y: Math.random() * height, v: Math.random() }));
    }

    function frame() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        p.a += 0.003 + signal.sound * 0.04 + signal.return * 0.01;
        p.x += Math.cos(p.a) * (0.12 + signal.motion * 2.2);
        p.y += Math.sin(p.a) * (0.12 + signal.sound * 1.4);
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        const radius = 70 + signal.sound * 170 + signal.coherence * 60;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        gradient.addColorStop(0, `rgba(255,99,216,${0.045 + signal.light * 0.08 + signal.return * 0.08})`);
        gradient.addColorStop(0.45, `rgba(103,231,255,${0.02 + signal.motion * 0.06})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 6.28);
        ctx.fill();
      }

      starCtx.clearRect(0, 0, width, height);
      starCtx.strokeStyle = `rgba(255,255,255,${0.04 + signal.coherence * 0.18})`;
      starCtx.fillStyle = `rgba(255,255,255,${0.18 + signal.light * 0.18})`;
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        s.y += 0.04 + signal.sound * 0.25;
        if (s.y > height) s.y = 0;
        starCtx.beginPath();
        starCtx.arc(s.x, s.y, 1 + s.v * 1.6 + signal.return * 1.8, 0, 6.28);
        starCtx.fill();
        for (let j = i + 1; j < stars.length; j += 1) {
          const o = stars[j];
          const distance = Math.hypot(s.x - o.x, s.y - o.y);
          const limit = 95 + signal.coherence * 80;
          if (distance < limit) {
            starCtx.globalAlpha = (1 - distance / limit) * (0.12 + signal.return * 0.28);
            starCtx.beginPath();
            starCtx.moveTo(s.x, s.y);
            starCtx.lineTo(o.x, o.y);
            starCtx.stroke();
            starCtx.globalAlpha = 1;
          }
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [signal]);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      setSignal((previous) => {
        const history = historyRef.current;
        history.push(previous);
        historyRef.current = history.slice(-90);
        const recent = historyRef.current.slice(-24);
        let coherence = previous.coherence;
        let returning = previous.return;
        if (recent.length > 8) {
          const average = (key) => recent.reduce((sum, item) => sum + item[key], 0) / recent.length;
          const drift = Math.abs(previous.sound - average('sound')) * 2.2 + Math.abs(previous.motion - average('motion')) * 2.4 + Math.abs(previous.light - average('light')) * 1.2;
          coherence = clamp(1 - drift);
          const signature = `${Math.round(previous.sound * 10)}:${Math.round(previous.motion * 10)}:${Math.round(previous.light * 10)}:${Math.round(previous.still * 10)}`;
          returning = mix(previous.return, signature === lastSignatureRef.current ? 1 : 0, 0.06);
          lastSignatureRef.current = signature;
        }
        return {
          ...previous,
          sound: mix(previous.sound, 0, 0.02),
          motion: mix(previous.motion, 0, 0.025),
          still: clamp(previous.still + 0.012 - previous.sound * 0.04 - previous.motion * 0.05),
          coherence,
          return: returning,
        };
      });
    }, 360);
    return () => clearInterval(interval);
  }, [started]);

  useEffect(() => {
    log(`State shifted into ${stateName}: ${current.body}`);
  }, [stateName]);

  async function openRoom() {
    if (started) return;
    setStarted(true);
    log('Room opened. Signals stay local: microphone amplitude and low-resolution camera brightness/motion.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 320, height: 240, facingMode: 'user' } });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setupAudio(stream);
      setupVideo(video);
    } catch (error) {
      log('Sensor permission unavailable. Fallback mode uses page rhythm and manual calibration.');
    }
  }

  function setupAudio(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioRef.current = { context, analyser };
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      let peak = 0;
      for (const value of data) {
        sum += value;
        if (value > peak) peak = value;
      }
      const raw = ((sum / data.length) * 0.7 + peak * 0.3) / 255;
      const adjusted = clamp((raw - baseline.sound) * 4.8);
      setSignal((previous) => ({ ...previous, sound: mix(previous.sound, silent ? 0 : adjusted, 0.18) }));
      requestAnimationFrame(tick);
    }
    tick();
  }

  function setupVideo(video) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 96;
    canvas.height = 72;
    let previousFrame = null;

    function tick() {
      if (video.readyState >= 2) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let light = 0;
        let difference = 0;
        const nextFrame = new Float32Array(image.length / 4);
        for (let i = 0, j = 0; i < image.length; i += 4, j += 1) {
          const luminance = (image[i] + image[i + 1] + image[i + 2]) / (3 * 255);
          nextFrame[j] = luminance;
          light += luminance;
          if (previousFrame) difference += Math.abs(luminance - previousFrame[j]);
        }
        light /= nextFrame.length;
        const motion = previousFrame ? clamp((difference / nextFrame.length) * 7.5) : 0;
        previousFrame = nextFrame;
        setSignal((previous) => ({
          ...previous,
          light: mix(previous.light, light, 0.08),
          motion: mix(previous.motion, motion, 0.22),
          still: clamp(1 - (motion * 1.18 + previous.sound * 0.78)),
        }));
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  const vars = {
    '--sound': signal.sound.toFixed(3),
    '--motion': signal.motion.toFixed(3),
    '--light': signal.light.toFixed(3),
    '--still': signal.still.toFixed(3),
    '--coherence': signal.coherence.toFixed(3),
    '--return': signal.return.toFixed(3),
    '--pulse': `${mix(10, 2.8, Math.max(signal.sound, signal.motion)).toFixed(2)}s`,
  };

  return (
    <main id="app" className={`shell ${ritual ? 'ritual' : ''}`} style={vars} aria-live="polite">
      <style>{styles}</style>
      <section className="field" id="field">
        <canvas ref={atmosphereRef} id="atmosphere" aria-hidden="true" />
        <canvas ref={constellationRef} id="constellation" aria-hidden="true" />
        <div className="aurora" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="breath-orb" aria-hidden="true"><span /></div>

        <section className="panel" id="panel">
          <p className="eyebrow">Mirror Cartographer / recursive interface instrument</p>
          <h1>{current.title}</h1>
          <p className="state-text">{current.text}</p>
          <div className="phase-line">{stateName} / {current.phase}</div>
          <div className="metrics" aria-label="detected atmosphere metrics">
            <Metric label="sound" value={signal.sound} />
            <Metric label="motion" value={signal.motion} />
            <Metric label="light" value={signal.light} />
            <Metric label="stillness" value={signal.still} />
            <Metric label="coherence" value={signal.coherence} />
            <Metric label="return" value={signal.return} />
          </div>
          <div className="intent">{intentFor(stateName)}</div>
          <div className="actions">
            <button onClick={openRoom}>{started ? 'Room open' : 'Open the room'}</button>
            <button onClick={() => { setBaseline({ sound: signal.sound, motion: signal.motion, light: signal.light }); log('Baseline taken. The room is now the reference point.'); }}>Take room baseline</button>
            <button onClick={() => { setRitual((value) => !value); log(!ritual ? 'Ritual mode: less log, more field.' : 'Field mode: trace restored.'); }}>{ritual ? 'Field mode' : 'Ritual mode'}</button>
            <button onClick={() => { setSilent((value) => !value); log(!silent ? 'Sound signal muted.' : 'Sound signal restored.'); }}>{silent ? 'Restore sound signal' : 'Mute sound signal'}</button>
          </div>
        </section>

        <aside className="bodymap" aria-label="body resonance map">
          <h2>Body / field</h2>
          <div className="figure">
            <i className="head" /><i className="throat" /><i className="heart" /><i className="gut" /><i className="hands" /><i className="feet" />
          </div>
          <p>{current.body}</p>
        </aside>

        <aside className="journal" aria-label="recursive observation log">
          <h2>Recursive trace</h2>
          <ol>{trace.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
        </aside>

        <video ref={videoRef} playsInline muted aria-hidden="true" />
      </section>
    </main>
  );
}

const styles = `
:root{color-scheme:dark}*{box-sizing:border-box}html,body,#root{min-height:100%;margin:0}body{background:#020106;color:#fff8ff;overflow:hidden;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.shell{--bg1:#030207;--bg2:#0d0b18;--text:#fff8ff;--muted:#b9adc9;--accent:#ff63d8;--accent2:#67e7ff;--warm:#ffd36b;min-height:100vh;position:relative}.field{position:relative;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) 310px;grid-template-rows:1fr auto;gap:18px;padding:28px;align-items:center;background:radial-gradient(circle at calc(18% + var(--motion)*44%) calc(20% + var(--sound)*40%),rgba(255,99,216,.42),transparent 30%),radial-gradient(circle at calc(82% - var(--still)*30%) calc(74% - var(--light)*22%),rgba(103,231,255,.35),transparent 34%),radial-gradient(circle at 50% 50%,rgba(255,211,107,calc(var(--coherence)*.2)),transparent 28%),linear-gradient(135deg,var(--bg1),var(--bg2));transition:background 1000ms ease,filter 800ms ease;filter:saturate(calc(.82 + var(--coherence)*.8)) contrast(calc(.94 + var(--return)*.3))}#atmosphere,#constellation{position:absolute;inset:0;width:100%;height:100%;opacity:.76}.aurora{position:absolute;inset:-15%;background:conic-gradient(from calc(var(--motion)*220deg),transparent,rgba(255,99,216,.18),transparent,rgba(103,231,255,.16),transparent,rgba(154,255,199,.1),transparent);filter:blur(60px);animation:turn calc(34s - var(--sound)*20s) linear infinite;mix-blend-mode:screen}.vignette{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 18%,rgba(0,0,0,.76) 100%);pointer-events:none}@keyframes turn{to{transform:rotate(1turn)}}.panel{position:relative;z-index:3;max-width:980px;padding:34px;border:1px solid rgba(255,255,255,.17);border-radius:34px;background:rgba(6,5,16,.50);backdrop-filter:blur(22px);box-shadow:0 0 calc(50px + var(--sound)*90px) rgba(103,231,255,.12),inset 0 0 70px rgba(255,255,255,.035)}.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:12px;color:var(--muted);margin:0 0 18px}h1{font-size:clamp(40px,6.8vw,104px);line-height:.9;letter-spacing:-.075em;margin:0 0 24px;text-wrap:balance}.state-text{font-size:clamp(17px,2.05vw,25px);line-height:1.38;color:#eadff1;max-width:860px}.phase-line{display:inline-flex;margin:4px 0 16px;padding:9px 13px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);color:var(--warm);font-size:13px;letter-spacing:.08em;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(6,minmax(78px,1fr));gap:10px;margin:28px 0}.metrics div{border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:13px;background:rgba(255,255,255,.06)}.metrics span{display:block;font-size:24px;font-weight:800}.metrics label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}.intent{min-height:28px;color:var(--warm);font-size:15px;margin:16px 0 0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}button{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.09);color:var(--text);border-radius:999px;padding:12px 16px;font-weight:800;cursor:pointer}button:hover{background:rgba(255,255,255,.17)}.breath-orb{position:absolute;z-index:2;left:50%;top:50%;width:min(62vw,720px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(calc(.74 + var(--still)*.18 + var(--sound)*.11));border:1px solid rgba(255,255,255,.12);box-shadow:0 0 100px rgba(255,99,216,.13);animation:breathe var(--pulse) ease-in-out infinite;pointer-events:none}.breath-orb span{position:absolute;inset:16%;border-radius:50%;border:1px dashed rgba(255,255,255,.12)}@keyframes breathe{0%,100%{opacity:.25}50%{opacity:.75}}.bodymap,.journal{position:relative;z-index:3;border:1px solid rgba(255,255,255,.13);border-radius:28px;padding:20px;background:rgba(2,2,8,.42);backdrop-filter:blur(20px)}.bodymap{grid-column:2;grid-row:1;align-self:start}.journal{grid-column:1/-1;grid-row:2;max-height:28vh;overflow:auto}.bodymap h2,.journal h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 14px}.journal ol{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;list-style:none;padding:0;margin:0}.journal li{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;color:#ddd;font-size:13px;line-height:1.35;background:rgba(255,255,255,.035)}.figure{height:310px;position:relative;border-radius:26px;background:radial-gradient(circle at 50% 26%,rgba(255,99,216,calc(.12 + var(--light)*.12)),transparent 12%),radial-gradient(circle at 50% 48%,rgba(255,72,95,calc(.10 + var(--sound)*.35)),transparent 13%),radial-gradient(circle at 50% 68%,rgba(103,231,255,calc(.08 + var(--still)*.18)),transparent 17%);border:1px solid rgba(255,255,255,.10);overflow:hidden}.figure i{position:absolute;border-radius:999px;background:rgba(255,255,255,.72);box-shadow:0 0 calc(18px + var(--sound)*50px) rgba(255,99,216,.55)}.head{width:54px;height:54px;left:50%;top:32px;transform:translateX(-50%)}.throat{width:28px;height:46px;left:50%;top:90px;transform:translateX(-50%);opacity:calc(.35 + var(--coherence)*.65)}.heart{width:86px;height:86px;left:50%;top:124px;transform:translateX(-50%);background:rgba(255,72,95,.75)!important;opacity:calc(.40 + var(--sound)*.6)}.gut{width:76px;height:64px;left:50%;top:207px;transform:translateX(-50%);background:rgba(103,231,255,.62)!important}.hands{width:210px;height:18px;left:50%;top:155px;transform:translateX(-50%);opacity:calc(.28 + var(--motion)*.72)}.feet{width:138px;height:18px;left:50%;bottom:24px;transform:translateX(-50%);opacity:calc(.4 + var(--still)*.6)}.bodymap p{color:#d8cedf;font-size:14px;line-height:1.38;margin:14px 0 0}video{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.shell.ritual .panel{box-shadow:0 0 120px rgba(255,99,216,.2),inset 0 0 90px rgba(255,211,107,.05)}.shell.ritual .journal{display:none}.shell.ritual .field{grid-template-columns:1fr 300px}@media(max-width:1080px){body{overflow:auto}.field{grid-template-columns:1fr;padding:16px;overflow:auto}.bodymap,.journal{grid-column:1}.metrics{grid-template-columns:repeat(3,1fr)}.journal{max-height:none}.journal ol{grid-template-columns:1fr}.bodymap{align-self:auto}.breath-orb{width:86vw}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export default App;
