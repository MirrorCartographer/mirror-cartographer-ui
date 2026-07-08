# Capability Gate: Audio-Visual Coupling Without Mobile Regression

Status: implementation-ready gate
Date: 2026-07-08
Target: phone-first wordless weather/music website

## Current pass/fail reading

The live app already has the right major seams:

- `src/components/App.jsx` owns the gesture loop, canvas state, pulse/rhythm state, and calls the music engine from pointer input.
- `src/engine/skyMusic.js` owns a tap-unlocked Web Audio composition engine with phrase form, groove maps, weather roots, chord voicing, bass movement, counterline, noise texture, lookahead scheduling, and limiter routing.
- Recent commits show the project is already moving from "tap makes sound" toward a structured composition system.

This gate therefore rejects broad rewrites. The next capability gain should be a narrow bridge between already-existing visual rhythm and already-existing musical phrase state.

## High-signal capability to build next

Add a tiny `performanceSignal` object emitted by the music engine and read by the canvas renderer.

Shape:

```js
{
  beat: number,          // 0..1 phase inside current beat
  phrase: number,        // 0..7 phrase index from FORM
  section: string,       // seed | lift | answer | storm | home
  accent: number,        // groove accent 0..1
  density: number,       // estimated event load 0..1
  cadence: boolean       // true near home/cadence gestures
}
```

Use it only as nonverbal behavior:

- stronger orbit glow on accents
- slower heart expansion during `home`
- creature/comet cohesion during `answer`
- brief sky brightening on `storm`
- reduced particle count when `density` rises

Do not display labels. Do not add explanatory text.

## Hard quality constraints

1. Do not increase `MAX_EVENTS_PER_TICK`.
2. Do not reduce `LOOKAHEAD_MS` below the current safe interval.
3. Do not create audio nodes inside animation frames.
4. Do not let canvas request audio state by polling Web Audio internals.
5. Do not add autoplay or background playback.
6. Do not create persistent storage or identity logic for this pass.
7. Do not make state changes depend on network calls.

## Recommended implementation path

Smallest safe patch:

1. In `createSkyMusic`, store the latest performance signal in a plain local variable.
2. Update it inside `scheduleOne` after groove/section/cadence are calculated.
3. Return `getSignal()` from the music engine.
4. In `App.jsx`, read `musicRef.current?.getSignal?.()` inside the visual loop through a ref, not React state.
5. Use the signal only to modulate existing drawing variables, not to create a new UI layer.

## Acceptance tests

Manual phone test:

- First tap starts sound; no sound before tap.
- Rapid taps do not crackle.
- Leaving the tab and returning does not stack duplicate schedulers.
- Visual accents feel musically timed but remain wordless.
- Reduced-motion users do not get a more frantic experience.
- The app still works if Web Audio is unsupported.

Code review test:

- No visible words added to the interface.
- No extra dependencies.
- No global event listeners without cleanup.
- No new loops faster than animation frame or existing scheduler.
- New signal object is optional and failure-tolerant.

## Gate decision

Approved direction: audio-to-visual performance signal.

Rejected directions for this pass: bigger synthesis engine, sample loading, microphone input, saved personalization, explanatory UI, heavier particle systems, or full composition rewrite.
