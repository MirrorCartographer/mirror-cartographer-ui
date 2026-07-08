# Phrase-boundary weather state gate

## Capability branch

Weather-to-composition state should not snap immediately on every touch or sensor update. The next capability primitive is a small composition gate that separates requested weather state from active musical weather state.

## Build direction

Add two weather variables inside `createSkyMusic`:

- `currentState`: the state actively used by the scheduler.
- `pendingState`: the latest requested state from `start` or `pulse`.

On `start`, apply the requested state immediately so tap-to-start still feels responsive.

On later `pulse` calls, update `pendingState` only. The scheduler adopts it only when `inPhrase === 0`.

When adoption happens, clear `previousVoicing` so chord voicing re-seeds cleanly for the new weather root.

## Quality gate reason

This improves capability more than adding another voice because it creates a reusable phrase-boundary transition primitive. Future visual notation, choreography, weather shifts, and instruments can subscribe to the same rule instead of changing independently.

## Mobile constraints

- No autoplay.
- No visible explanatory words.
- No new timers.
- No animation-frame allocation.
- Constant-time state check per scheduled note.
- Tap boot voice remains immediate.

## Minimal implementation sketch

```js
let currentState = 'cloud';
let pendingState = 'cloud';

function validState(state, fallback = 'cloud') {
  return WEATHER_ROOTS[state] ? state : fallback;
}

function absorbSnapshot(snapshot = {}, immediate = false) {
  const nextState = validState(snapshot.state, currentState);
  if (immediate || !started) currentState = nextState;
  pendingState = nextState;
  currentPulse = Number.isFinite(snapshot.pulse) ? snapshot.pulse : currentPulse;
  currentRhythm = Number.isFinite(snapshot.rhythm) ? snapshot.rhythm : currentRhythm;
}

function alignWeatherAtPhrase(inPhrase) {
  if (inPhrase !== 0 || pendingState === currentState) return;
  currentState = pendingState;
  previousVoicing = null;
}
```

Call `alignWeatherAtPhrase(inPhrase)` inside `scheduleOne` immediately after `inPhrase` is computed and before root/groove/beat values are derived.
