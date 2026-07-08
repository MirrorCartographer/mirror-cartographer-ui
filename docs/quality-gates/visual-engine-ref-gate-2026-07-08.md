# Visual Engine Ref Gate

Capability decision: preserve the wordless phone-first weather/music instrument, but prune visual-engine churn before adding more musical branches.

## Gate finding

The music engine is now structurally stronger than the rendering loop: phrase form, weather roots, breath masks, modulation, counterpoint, phrase memory, and phrase-boundary weather adoption are useful primitives. The next high-signal capability gain is not another voice. It is making the visual engine behave like a stable subscriber to composition state.

Current risk: high-frequency React state changes can recreate the canvas animation effect, reseed visual particles, and restart requestAnimationFrame work. That threatens mobile stability and can make audio-visual coupling feel less intentional.

## Required next source change

Refactor the wordless sky canvas effect so it mounts once and reads mutable refs for:

- weather state
- pulse
- marks
- rhythm

Do not include those live values in the animation effect dependency array.

Expected pattern:

```js
const skyInputRef = useRef({ state, pulse, marks, rhythm });
useEffect(() => {
  skyInputRef.current = { state, pulse, marks, rhythm };
}, [state, pulse, marks, rhythm]);

const canvasRef = useWordlessSky(skyInputRef);
```

Inside the animation loop, read:

```js
const { state, pulse, marks, rhythm } = inputRef.current;
```

The canvas effect should depend only on the input ref object, not on the fast-changing state fields.

## Acceptance gate

Keep:

- no autoplay
- tap-to-start audio
- no visible explanatory words
- one animation loop
- bounded marks and particles
- existing musical scheduler budget

Reject:

- new visible onboarding text
- new timers for visual effects
- recreating particle seeds on every pulse/rhythm decay
- allocating audio nodes from visual frames
- generic decorative effects not driven by musical or gesture state

## Why this matters

This creates a reusable architecture boundary:

- React handles coarse interaction state.
- The canvas loop stays persistent.
- Music and visuals can subscribe to the same composition state later.
- Future AI-composition or notation layers can be added without destabilizing mobile playback.

This is a capability gain, not cosmetic polish.