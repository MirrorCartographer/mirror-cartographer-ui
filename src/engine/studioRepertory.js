const PRODUCTIONS = [
  { title: 'Before the Name', mode: 'negative-space', tempo: 'still', lens: 'wide' },
  { title: 'Weather Has a Memory', mode: 'weather', tempo: 'drift', lens: 'soft' },
  { title: 'The Hand-Drawn Machine', mode: 'sketch', tempo: 'tremor', lens: 'close' },
  { title: 'Midnight Editing Room', mode: 'editorial', tempo: 'cut', lens: 'narrow' },
  { title: 'Creature Signal', mode: 'creature', tempo: 'pulse', lens: 'low' },
  { title: 'Archive Under Glass', mode: 'archive', tempo: 'still', lens: 'macro' },
  { title: 'Carnival After Closing', mode: 'carnival', tempo: 'sway', lens: 'tilt' },
  { title: 'Evidence Constellation', mode: 'observatory', tempo: 'orbit', lens: 'wide' },
  { title: 'California Future Memory', mode: 'coastal', tempo: 'glide', lens: 'long' },
  { title: 'Animal Continuity Department', mode: 'creature', tempo: 'breath', lens: 'close' },
  { title: 'Body as Instrument Panel', mode: 'laboratory', tempo: 'measure', lens: 'macro' },
  { title: 'The Symbol Wardrobe', mode: 'theatre', tempo: 'reveal', lens: 'portrait' },
  { title: 'No Single Door', mode: 'portal', tempo: 'branch', lens: 'split' },
  { title: 'Rain Score for Small Machines', mode: 'weather', tempo: 'rain', lens: 'soft' },
  { title: 'Continuity Supervisor', mode: 'editorial', tempo: 'cut', lens: 'narrow' },
  { title: 'The Beautiful Constraint', mode: 'blueprint', tempo: 'measure', lens: 'wide' },
  { title: 'Field of Unfinished Things', mode: 'garden', tempo: 'grow', lens: 'low' },
  { title: 'Proof Film', mode: 'laboratory', tempo: 'focus', lens: 'macro' },
  { title: 'Ocean Between Systems', mode: 'coastal', tempo: 'tide', lens: 'long' },
  { title: 'A Studio That Remembers', mode: 'archive', tempo: 'reel', lens: 'portrait' },
  { title: 'Backlot of Possible Worlds', mode: 'portal', tempo: 'branch', lens: 'split' },
  { title: 'Music Without a Control Panel', mode: 'carnival', tempo: 'sway', lens: 'tilt' },
  { title: 'Operating System for a Life', mode: 'blueprint', tempo: 'pulse', lens: 'wide' },
  { title: 'The Studio Dreams Itself', mode: 'observatory', tempo: 'orbit', lens: 'soft' },
];

export function productionForDate(date = new Date()) {
  const hour = Number.isFinite(date?.getHours?.()) ? date.getHours() : 0;
  return { ...PRODUCTIONS[((hour % 24) + 24) % 24], hour };
}

function minutesUntilNextHour(date = new Date()) {
  return Math.max(1000, (60 - date.getMinutes()) * 60000 - date.getSeconds() * 1000 - date.getMilliseconds());
}

function applyProduction(production, doc) {
  const root = doc.documentElement;
  root.dataset.studioHour = String(production.hour).padStart(2, '0');
  root.dataset.studioMode = production.mode;
  root.dataset.studioTempo = production.tempo;
  root.dataset.studioLens = production.lens;
  root.style.setProperty('--studio-hour', production.hour);

  let slate = doc.querySelector('[data-studio-slate]');
  if (!slate) {
    slate = doc.createElement('aside');
    slate.dataset.studioSlate = '';
    slate.setAttribute('aria-live', 'polite');
    slate.innerHTML = '<span data-studio-kicker>NOW SHOWING</span><strong data-studio-title></strong><span data-studio-time></span>';
    doc.body.appendChild(slate);
  }
  slate.querySelector('[data-studio-title]').textContent = production.title;
  slate.querySelector('[data-studio-time]').textContent = `${String(production.hour).padStart(2, '0')}:00–${String((production.hour + 1) % 24).padStart(2, '0')}:00`;

  doc.dispatchEvent(new CustomEvent('mirrorcartographer:productionchange', { detail: production }));
}

export function installStudioRepertoryRuntime({ window: win = window, document: doc = document } = {}) {
  if (!win || !doc || win.__MC_STUDIO_REPERTORY__) return win?.__MC_STUDIO_REPERTORY__;
  let timer;
  const screen = () => {
    const now = new Date();
    const production = productionForDate(now);
    applyProduction(production, doc);
    win.clearTimeout(timer);
    timer = win.setTimeout(screen, minutesUntilNextHour(now) + 25);
    return production;
  };
  const api = { screen, current: screen, productions: PRODUCTIONS.slice() };
  win.__MC_STUDIO_REPERTORY__ = api;
  return api;
}

export { PRODUCTIONS };