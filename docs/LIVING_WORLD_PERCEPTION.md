# The Between — perception and presence

## What is actually connected

The Living World is a client-side experience served as a static GitHub Pages application. Its current perception inputs are deliberately separated:

| Input | Permission | What it can observe | What it cannot establish |
|---|---|---|---|
| Pointer movement | No extra permission | Position, approach, dwell, stillness | Identity, attention, emotion |
| Page visibility/focus | Browser event | Whether the page is visible/focused | Whether a person is present |
| Keyboard focus and touch | Browser event | Which resident control is focused or touched | Identity, intention, or attention beyond that action |
| Browser-local visitor key | Browser storage | Return to the same browser profile | Real-world identity or cross-device identity |
| Microphone amplitude | Explicit visitor action + browser permission | A local sound-level envelope | Words, speaker identity, intent, mood, or meaning |

## Microphone boundary

"LET THEM HEAR" requests microphone access only after an explicit click. The stream is connected to a Web Audio analyser, not to the audio output. The app computes a short-lived RMS amplitude envelope in the browser and uses it only to animate Tazar and Jello.

The sound envelope is transient and used only for visual response. It is not retained in browser memory. The experience also observes touch and keyboard focus, plus whether the page is visible or blurred.

The Living World does not:
- record or retain audio;
- upload microphone samples;
- run speech recognition or transcription;
- infer emotion, identity, health, or intent from sound;
- store microphone levels in visitor memory.

Stopping listening stops the media tracks, cancels the animation frame, disconnects the source, and closes the audio context. Permission denial and unsupported browsers are surfaced as states rather than treated as successful sensing.

## Existing MC infrastructure that is not yet connected here

The wider repositories contain separate work for:
- Supabase-backed authenticated continuity records in the UI's server API;
- public interaction ingestion in the core repository's Pages Function;
- audio capture/evidence and output-routing research tools;
- peer execution runtimes with durable journals;
- co-presence and memory boundary research.

Those components are not automatically part of this GitHub Pages scene. The UI's `api/` and `server/` modules require a compatible server deployment and configured secrets. The static Pages build does not make those server routes appear. The core repository's peer execution runtime is not a visitor-presence service. No live shared-world database, real-time visitor channel, or character inference API is claimed by this page.

## Perception roadmap

1. **Local interaction sensing** — pointer, dwell, stillness, focus, visibility.
2. **Consented acoustic envelope** — local amplitude only; no recording/transcription.
3. **Sensor provenance** — label every observation with source, permission, timestamp, confidence, and expiry.
4. **Character response policy** — map observable signals to bounded visual/dialogue changes; no hidden emotional claims.
5. **Session continuity** — distinguish browser-local memory from authenticated account memory.
6. **Shared presence** — only after a real backend, authenticated identities, opt-in visibility, retention policy, and cross-user privacy tests exist.
7. **Agentic character dialogue** — only when a real model/runtime, memory scope, provenance, safety boundary, and failure handling are connected and tested.

## Release truth

A source-level contract test is not a browser test. A committed workflow is not a passing build. A successful build is not proof that the published Pages URL serves the same commit. These are separate verification stages and must be reported separately.
