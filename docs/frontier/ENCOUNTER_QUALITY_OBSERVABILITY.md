# Encounter Quality Observability

Status: frontier research handoff
Date: 2026-07-11
Owner: Frontier Research Team
Target surface: Vercel encounter runtime

## Why this exists

The repository already contains deterministic contracts for phone behavior, field encounter state, possibility-field runtime, interaction-path memory, deployment gates, and re-experience. Those tests establish structural intent, but they do not yet answer four runtime questions on a real device:

1. Did a gesture produce a visible response quickly enough?
2. Did animation work monopolize the main thread?
3. Did audio actually enter a running, audible graph after the owning gesture?
4. Did loops and audio suspend and recover correctly across page visibility changes?

This document defines a single browser-side evidence model for those questions. It is deliberately local-first: the first implementation should expose a diagnostic snapshot and support Playwright assertions without transmitting personal interaction history.

## Research basis

### Long Animation Frames

The W3C Long Animation Frames draft defines `PerformanceLongAnimationFrameTiming` for frames that exceed 50 ms and exposes duration, blocking duration, render start, style/layout start, and script attribution. This is more aligned with perceived animation congestion than raw long-task counting because it describes the unit that ends in rendering or a browser decision not to render.

Source: https://w3c.github.io/long-animation-frames/

### Event Timing

The W3C Event Timing API exposes event-processing timing and interaction identifiers that can group related input events. It is the standards-level substrate for measuring interaction latency rather than merely handler execution time.

Source: https://w3c.github.io/event-timing/

### Page lifecycle

The Page Lifecycle model distinguishes active, passive, hidden, frozen, and terminated states. The implementation must treat `visibilitychange`, `pagehide`, `pageshow`, `freeze`, and `resume` as ownership transitions for animation and audio rather than incidental browser events.

Source: https://wicg.github.io/page-lifecycle/

### Web Audio state

The Web Audio specification defines `AudioContext.state` values including `suspended`, `running`, and `closed`, along with `resume()` and state-change events. A successful `resume()` is necessary evidence but is not sufficient evidence of audibility; the graph must also show nonzero post-master signal during an expected audible window.

Source: https://webaudio.github.io/web-audio-api/

## Core design principle

**Encounter quality is a joined state, not a single metric.**

A gesture is considered successful only when its input, semantic transition, visual response, audio response where applicable, and lifecycle ownership can be connected by one `encounterId`.

## Event schema

Each event is an append-only record:

```ts
type EncounterQualityEvent = {
  schemaVersion: 1;
  encounterId: string;
  sessionId: string;
  sequence: number;
  timestamp: number;
  source:
    | "input"
    | "state"
    | "visual"
    | "audio"
    | "performance"
    | "lifecycle"
    | "deployment";
  name: string;
  data: Record<string, string | number | boolean | null>;
};
```

### Required event names

#### Input

- `gesture.received`
  - `gestureType`
  - `pointerType`
  - `isTrusted`
  - `interactionId` when exposed
- `gesture.semantic-transition`
  - `fromState`
  - `toState`
  - `transitionName`

#### Visual

- `visual.response-start`
  - `responseName`
  - `latencyFromGestureMs`
- `visual.frame-budget-change`
  - `tier`: `full | reduced | minimal | suspended`
  - `reason`

#### Performance

- `performance.long-animation-frame`
  - `durationMs`
  - `blockingDurationMs`
  - `renderDurationMs`
  - `styleLayoutDurationMs`
  - `topInvoker`
  - `topSource`
- `performance.event-timing`
  - `eventName`
  - `durationMs`
  - `processingStartDelayMs`
  - `presentationDelayMs` when derivable

#### Audio

- `audio.context-state`
  - `state`
  - `reason`
- `audio.resume-attempt`
  - `ownedByTrustedGesture`
  - `beforeState`
  - `afterState`
  - `resolved`
- `audio.signal-window`
  - `expectedAudible`
  - `peak`
  - `rms`
  - `masterGain`
  - `limiterConnected`

#### Lifecycle

- `lifecycle.transition`
  - `from`
  - `to`
  - `visibilityState`
  - `persisted` when applicable
- `lifecycle.owner-count`
  - `rafLoops`
  - `timers`
  - `audioContexts`

#### Deployment

- `deployment.identity`
  - `commitSha`
  - `buildId`
  - `surface`

## Derived encounter assertions

### EQ-1 Gesture-to-visual response

For each trusted gesture that causes a semantic transition, the first corresponding visual response must begin within:

- target: 100 ms
- warning: over 100 ms
- failure: over 250 ms or absent

This is an engineering budget, not a claim that every frame must complete within 100 ms.

### EQ-2 Main-thread congestion

During a five-second active encounter window:

- no individual long animation frame may exceed 250 ms
- total blocking duration should remain below 200 ms
- repeated frames above 50 ms must trigger a lower visual fidelity tier

Fallback when `long-animation-frame` is unsupported: observe `longtask` entries where available and combine them with requestAnimationFrame delta sampling. Mark fallback evidence as lower confidence.

### EQ-3 Tap-owned audio

An audio start passes only when all are true:

1. `resume()` occurs synchronously within the trusted gesture call path or its specification-permitted continuation.
2. `AudioContext.state` becomes `running`.
3. An expected-audible signal window records nonzero RMS above a calibrated floor.
4. Master gain is nonzero and the limiter/output route is connected.
5. No second audio context is created by the same gesture.

This separates "Safari shows a media session" from "the encounter emitted audible signal."

### EQ-4 Hidden-state ownership

Within 250 ms of entering hidden or frozen state:

- active animation owner count becomes zero
- expensive timers are cancelled or demoted
- audio is suspended unless explicitly designed to continue

After `pageshow` or resume:

- exactly one animation owner restarts
- the prior encounter state is restored
- audio does not restart without its existing permission and intended ownership rule

### EQ-5 Adaptive fidelity

The runtime exposes one current fidelity tier:

- `full`: normal rendering
- `reduced`: lower particle count, lower update rate, expensive effects disabled
- `minimal`: semantic response remains but ambient animation is nearly absent
- `suspended`: hidden/frozen ownership state

Tier changes must be driven by evidence and hysteresis. A single slow frame must not cause oscillation.

Suggested transition policy:

```text
full -> reduced:
  3 long animation frames within 5 seconds
  OR blocking duration > 200 ms within 5 seconds

reduced -> minimal:
  2 frames > 150 ms within 5 seconds after reduction

minimal -> reduced:
  10 seconds without a frame > 75 ms

reduced -> full:
  20 seconds without a frame > 75 ms

any -> suspended:
  hidden or frozen
```

## Proposed module boundaries

```text
src/diagnostics/encounterQuality.js
  createEncounterQualityRecorder()
  recordEncounterEvent()
  getEncounterQualitySnapshot()
  subscribeEncounterQuality()

src/diagnostics/performanceObserver.js
  observeLongAnimationFrames()
  observeEventTiming()
  createRafDeltaFallback()

src/diagnostics/audioProbe.js
  attachAudioSignalProbe(audioContext, masterNode)
  sampleExpectedAudibleWindow()

src/engine/lifecycleOwner.js
  registerAnimationOwner()
  registerTimerOwner()
  registerAudioOwner()
  suspendOwners()
  resumeOwners()

src/engine/fidelityController.js
  updateFidelityFromEvidence()
  getCurrentFidelityTier()
```

## Privacy and data minimization

Do not record:

- gesture coordinates
- free text
- symbol content entered by the user
- audio samples
- stable device fingerprinting fields

The default recorder should retain a bounded in-memory ring buffer. Test builds may expose it as `window.__MC_ENCOUNTER_QUALITY__`. Production export must remain opt-in until a separate provenance and privacy review exists.

## Test plan

### Deterministic unit contract

Create `scripts/encounter-quality-contract-check.mjs` to verify:

- schema version and required fields
- monotonic sequence numbers
- one `encounterId` joins input, state, visual, and audio records
- bounded ring-buffer behavior
- hysteresis prevents tier oscillation
- hidden transition forces `suspended`

### Playwright runtime test

Create `tests/encounter-quality.spec.js`:

1. Load the local preview.
2. Read deployment identity.
3. Trigger each primary gesture path.
4. Assert a semantic transition and visual response share an encounter ID.
5. Assert no duplicate loop owners.
6. Inject a controlled blocking workload in test mode and assert fidelity demotion.
7. Simulate page visibility where supported; otherwise invoke the lifecycle adapter through a test-only interface.
8. Assert the diagnostic snapshot contains no coordinate or free-text fields.

### Audio test split

Automated browser tests can verify graph structure, state transitions, gain values, and analyser output in supported test environments. They cannot replace a physical iPhone Safari audibility check. Keep the human/device probe as a release gate and attach the exact deployed commit SHA.

## Ranked implementation backlog

### P0 — recorder and lifecycle ownership

Implement the bounded recorder, deployment identity record, lifecycle transition records, and owner counts. This supplies evidence for existing hidden-tab and deployed-commit gates without changing the visual system.

Acceptance:

- local deterministic contract passes
- one snapshot shows deployment identity plus lifecycle owner counts
- hidden state produces zero animation owners

### P1 — audio signal probe

Attach an analyser after the master gain and before or after the limiter according to the actual graph. Record RMS/peak only during explicit expected-audible windows.

Acceptance:

- test oscillator produces nonzero RMS
- muted master produces zero or floor-level RMS
- the probe creates no additional AudioContext

### P2 — long-frame and event timing observers

Feature-detect supported performance entry types and record high-confidence or fallback evidence.

Acceptance:

- controlled 80 ms block produces a congestion record in Chromium
- unsupported browsers fail open without exceptions
- observer overhead remains bounded

### P3 — adaptive fidelity controller

Connect evidence to particle density, frame cadence, and expensive effects while preserving semantic transitions.

Acceptance:

- test workload demotes fidelity deterministically
- recovery uses hysteresis
- reduced motion remains an independent user preference and always wins over performance-driven promotion

## Decision for other teams

- Reliability Team should own P0 and P1.
- Toolsmith/Evaluator capability inside the Vercel team should own P2 test instrumentation.
- Visual Systems should consume, but not define, fidelity tiers in P3.
- Interaction Composition should attach encounter IDs to semantic transitions without storing private content.
- Frontier Research should revisit browser support and specification changes before remote telemetry is introduced.

## What is new relative to prior work

Prior contracts verify intended state wiring and deterministic paths. This proposal adds a cross-layer evidence join that can distinguish:

- gesture accepted vs. gesture visibly answered
- AudioContext running vs. actual signal present
- animation exists vs. animation remains within a responsive budget
- page hidden vs. all expensive owners actually suspended
- source commit known vs. deployed runtime identity observed

That distinction directly addresses the current gap between source-level confidence and deployed-browser proof.
