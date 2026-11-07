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

## Observation provenance

The scene now routes bounded observations through `src/engine/perceptionLedger.js`. Each event carries a source, permission state, observation timestamp, expiry, confidence, `local-only` scope, and `ephemeral` retention label. The in-memory ring buffer is capped at 64 observations and expires entries from snapshots. It accepts only bounded scalar values or normalized pointer coordinates; it rejects arbitrary objects and raw media payloads. The ledger is not written to localStorage, Supabase, or a network endpoint. It is a local sensing/provenance substrate, not a remote inference engine.

Current event types include pointer position/touch, resident focus, page visibility, window focus, microphone state, and a short-lived microphone RMS envelope.

## Microphone boundary

"LET THEM HEAR" requests microphone access only after an explicit click. The stream is connected to a Web Audio analyser, not to the audio output. The app computes a short-lived RMS amplitude envelope in the browser and uses it only to animate Tazar and Jello.

The sound envelope is transient and used only for visual response. It is not retained in browser memory. The experience also observes touch and keyboard focus, plus whether the page is visible or blurred.

The residents currently use bounded, scripted dialogue and deterministic visual state changes. They are not LLM-backed autonomous agents, and they do not independently form beliefs or remember other visitors.

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

## Shared-world substrate

`db/002_shared_world_presence.sql` adds authenticated connection requests and an expiring presence projection. Presence visibility is `private`, `connections`, or `public`; connection-only visibility requires an accepted relationship. The schema publishes the presence table to Supabase Realtime when the standard publication is available. It deliberately stores no microphone envelope, pointer coordinates, transcripts, inferred mood, or private continuity content.

The browser-side shared-world client and entry panel are now implemented. They use Supabase Auth magic links, a public anon key, Realtime Postgres Changes, expiring heartbeat presence, and explicit private/connections/public visibility. This is a connection path, not proof of a live connection. The migration must still be applied to the actual Supabase project, and the GitHub repository must supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Actions variables. The deployed build must then pass the shared-world smoke test. GitHub Pages does not execute the repository's `api/` serverless routes. No service-role key may be placed in browser code.

## Perception roadmap

1. **Local interaction sensing** — pointer, dwell, stillness, focus, visibility, and consented acoustic envelope.
2. **Observation provenance** — implemented as a bounded, ephemeral, local-only ledger.
3. **Character response policy** — map observable signals to bounded visual/dialogue changes; no hidden emotional claims.
4. **Session continuity** — browser-local memory exists; authenticated account continuity remains separate and needs a compatible server or direct RLS-protected client.
5. **Shared presence** — database schema is prepared; live authentication, client subscription, migration application, expiry cleanup, and cross-user privacy tests remain to be connected.
6. **Agentic character dialogue** — requires a real model/runtime, memory scope, provenance, safety boundary, and failure handling. The current resident dialogue remains scripted.
8. **Perception-to-agent bridge** — connect signal records to a real inference runtime only with explicit provenance, bounded memory, consent scopes, and observable failure states.

## Release truth

A source-level contract test is not a browser test. A committed workflow is not a passing build. A successful build is not proof that the published Pages URL serves the same commit. These are separate verification stages and must be reported separately.
