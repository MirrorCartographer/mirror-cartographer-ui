const clamp = (value) => Math.max(0, Math.min(1, value));

/**
 * Converts observable, permission-labelled signals into bounded scene cues.
 * This policy does not infer emotion, identity, intent, or health.
 */
export function deriveResidentResponse(observation) {
  if (!observation || observation.scope !== 'local-only' || observation.retention !== 'ephemeral') return null;
  if (observation.kind === 'pointer-position' && observation.value && typeof observation.value === 'object') {
    const { x, y } = observation.value;
    if (y > 0.42 && x > 0.34 && x < 0.66) return { cue: 'approach-tazar', resident: 'tazar', intensity: clamp((y - 0.42) / 0.58) };
    if (y > 0.5 && x >= 0.66) return { cue: 'approach-jello', resident: 'jello', intensity: clamp((x - 0.66) / 0.34) };
    return { cue: 'drift', resident: null, intensity: 0 };
  }
  if (observation.kind === 'audio-envelope' && typeof observation.value === 'number') {
    return observation.value >= 0.045
      ? { cue: 'sound', resident: 'both', intensity: clamp(observation.value) }
      : { cue: 'quiet', resident: null, intensity: 0 };
  }
  if (observation.kind === 'submitted-language') return { cue: 'conversation', resident: observation.value, intensity: 1 };
  if (observation.kind === 'resident-choice') return { cue: 'choice', resident: observation.value, intensity: 0.7 };
  if (observation.kind === 'character-focus') {
    return { cue: observation.value === 'jello' ? 'approach-jello' : 'approach-tazar', resident: observation.value, intensity: 1 };
  }
  if (observation.kind === 'page-visibility' && observation.value === false) return { cue: 'away', resident: null, intensity: 0 };
  if (observation.kind === 'page-visibility' && observation.value === true) return { cue: 'return', resident: null, intensity: 0 };
  if (observation.kind === 'window-focus' && observation.value === false) return { cue: 'away', resident: null, intensity: 0 };
  if (observation.kind === 'pointer-touch') return { cue: 'touch', resident: null, intensity: 1 };
  return null;
}
