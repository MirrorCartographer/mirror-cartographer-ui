import { createEncounterState } from './encounterState';
import { selectFieldEncounter } from './fieldEncounter';
import { SKY_STATES } from './skyState';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const rounded = (value) => Math.round(clamp01(value) * 1000) / 1000;

function activeWeather(documentRef) {
  const dots = [...documentRef.querySelectorAll('.orbit i')];
  const index = dots.findIndex((dot) => dot.classList.contains('on'));
  return SKY_STATES[index] || 'cloud';
}

export function derivePossibilityField({ interaction = {}, state = 'cloud', memory = {} } = {}) {
  const density = clamp01(
    interaction.repetition * 0.42
      + interaction.exploration * 0.34
      + interaction.tapVelocity * 0.24,
  );
  const frame = {
    state,
    section: interaction.count > 7 ? 'answer' : interaction.count > 3 ? 'lift' : 'seed',
    beat: interaction.count || 0,
    phrase: Math.floor((interaction.count || 0) / 4),
    phrasePhase: clamp01(((interaction.count || 0) % 4) / 4),
    pulse: clamp01(0.28 + interaction.tapVelocity * 0.52 + interaction.exploration * 0.2),
    density,
    rhythm: clamp01(interaction.tapVelocity * 0.7 + interaction.repetition * 0.3) * 12,
  };
  const encounter = selectFieldEncounter({ frame, interaction, memory });
  const visualPressure = clamp01(encounter.invitation.visualPressure);
  const warmth = clamp01(0.5 + encounter.fieldDelta.warmth * 0.45);
  const tension = clamp01(0.5 + encounter.fieldDelta.tension * 0.45);

  return {
    pressure: rounded(visualPressure),
    warmth: rounded(warmth),
    tension: rounded(tension),
    mood: encounter.selectedFuture.mood,
  };
}

export function installPossibilityFieldRuntime({ documentRef = document, windowRef = window } = {}) {
  const root = documentRef.documentElement;
  const encounterState = createEncounterState(Date.now());
  let memory = {};

  const apply = (event) => {
    if (event.isPrimary === false) return;
    const width = Math.max(1, windowRef.innerWidth || 1);
    const height = Math.max(1, windowRef.innerHeight || 1);
    const point = {
      x: clamp01(event.clientX / width),
      y: clamp01(event.clientY / height),
    };
    const interaction = encounterState.observe({ now: Date.now(), point });
    const field = derivePossibilityField({
      interaction,
      state: activeWeather(documentRef),
      memory,
    });
    memory = {
      turn: field.tension,
      rise: field.warmth,
    };

    root.style.setProperty('--possibility-pressure', field.pressure);
    root.style.setProperty('--possibility-warmth', field.warmth);
    root.style.setProperty('--possibility-tension', field.tension);
    root.style.setProperty('--possibility-x', `${Math.round(point.x * 100)}%`);
    root.style.setProperty('--possibility-y', `${Math.round(point.y * 100)}%`);
    root.dataset.possibilityMood = field.mood;
  };

  documentRef.addEventListener('pointerdown', apply, { capture: true, passive: true });
  return () => documentRef.removeEventListener('pointerdown', apply, { capture: true });
}
