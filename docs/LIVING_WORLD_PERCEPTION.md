# The Between — perception and presence

## What is actually connected

The Living World is a client-side experience served as a static GitHub Pages application. Its current perception inputs are deliberately separated:

| Input | Permission | What it can observe | What it cannot establish |
|---|---|---|---|
| Pointer movement | No extra permission | Cursor position for visual gaze only | Body position, approach, dwell, identity, attention, emotion |
| Tap/click on the ground or approach controls | Explicit scene interaction | A local visitor marker moves to the chosen point; arrival near Tazar/Jello triggers a character response | Real-world movement, identity, emotion, or intent |
| Page visibility/focus | Browser event | Whether the page is visible/focused | Whether a person is present |
| Keyboard focus and touch | Browser event | Which resident control is focused or touched | Identity, intention, or attention beyond that action |
| Browser-local visitor key | Browser storage | Return to the same browser profile | Real-world identity or cross-device identity |
| Authenticated account continuity | Explicit sign-in + opt-in private sync | Return to the same account across devices when Supabase is configured | Legal identity, another account, emotion, or intent |
| Camera / face landmarks | Not connected in this scene | Nothing; no camera stream is requested | Face presence, gaze, expression, or identity |
| Microphone amplitude | Explicit visitor action + browser permission | A local sound-level envelope | Words, speaker identity, intent, mood, or meaning |
| Submitted resident message | Explicit submit action | Final text entered into Tazar/Jello conversation | Drafts, deleted text, general typing behavior, or hidden context |

## Observation provenance
The optional **FIELD LOG** is a visitor-facing receipt for selected recent local events. It shows event type, source, permission, scope, and retention without exposing typed message content or pointer coordinates. It is a display of what the browser actually observed, not a claim that the system knows the visitor's inner state.


The scene now routes bounded observations through `src/engine/perceptionLedger.js`. Each event carries a source, permission state, observation timestamp, expiry, confidence, `local-only` scope, and `ephemeral` retention label. The in-memory ring buffer is capped at 64 observations and expires entries from snapshots. It accepts only bounded scalar values or normalized pointer coordinates; it rejects arbitrary objects and raw media payloads. The ledger is not written to localStorage, Supabase, or a network endpoint. It is a local sensing/provenance substrate, not a remote inference engine.

Current event types include cursor position, explicit visitor movement and resident approach, touch, stillness, resident focus, page visibility, window focus, microphone state, a short-lived microphone RMS envelope, the fact that a resident message was explicitly submitted, and explicit dialogue-choice IDs. Cursor position is used for eye gaze only; it does not count as physical approach. The visitor must move the in-scene marker by tapping/clicking the ground or selecting an approach control. The ledger does not retain the submitted text itself; the final message is sent to the configured resident provider only when the visitor submits it.

## Microphone boundary

"LET THEM HEAR" requests microphone access only after an explicit click. The stream is connected to a Web Audio analyser, not to the audio output. The app computes a short-lived RMS amplitude envelope in the browser and uses it only to animate Tazar and Jello.

The sound envelope is transient and used for local visual response. It is not retained in browser memory. If the visitor separately enables scene-cue sharing, only the derived cue and normalized intensity may accompany a submitted resident message. The experience also observes explicit scene movement, touch and keyboard focus, plus whether the page is visible or blurred.

When a visitor explicitly enters the shared room, the local scene also updates the shared presence projection with only one of four coarse states: `present`, `wandering`, `in-conversation`, or `away`. It never publishes the visitor marker position, cursor coordinates, approach target, microphone level, or typed text. The existing visibility selection and row-level security still determine who can see the projection.

The residents use deterministic local reactions and now have an optional, authenticated model-dialogue path through `supabase/functions/resident-dialogue`. Model use of private memory and sharing of ambient scene cues each require separate opt-ins. A visitor can send a message to Tazar or Jello; the request includes only a bounded scene cue and up to eight prior turns held in browser memory. The function verifies the Supabase session, calls a configured model provider, and does not write the conversation transcript to Supabase. This is request/response character dialogue, not a self-directed autonomous agent with ongoing goals.

The Living World does not:
- record or retain audio;
- upload microphone samples;
- run speech recognition or transcription;
- infer emotion, identity, health, or intent from sound;
- store microphone levels in visitor memory.

When a visitor sends a message, that message and the short in-session conversation context are transmitted to the configured model provider. Mirror Cartographer does not persist the transcript; provider-side processing and retention remain subject to that provider's terms. By default the model receives no ambient cue. A separate, off-by-default preference may send a categorical scene cue and normalized intensity, such as `sound`, `approach-tazar`, `still`, or `away`. It never receives raw microphone samples or pointer coordinates. Private memory storage and model use of private memory are separate opt-ins.

Stopping listening stops the media tracks, cancels the animation frame, disconnects the source, and closes the audio context. Permission denial and unsupported browsers are surfaced as states rather than treated as successful sensing.

## Existing MC infrastructure and its actual connection state

The wider project contains several related systems, but they do different jobs:

- **Face / signal protocols:** the core repository has face-value, signal-value, and nonverbal-signal methods. These are architecture and interpretation artifacts, not a deployed webcam/face-landmark runtime in The Between.
- **Audio evidence tools:** the core repository's audio-capture and evidence-fusion modules validate browser output routing and human audibility. They are not microphone transcription or room-sound perception.
- **Perception ledger:** The Between now has a working client-side observation ledger for pointer position, touch, focus, visibility, stillness, microphone permission, and local acoustic envelope. It is bounded and ephemeral.
- **Resident response policy:** the UI maps those observations to allowlisted scene cues without inferring emotion, identity, health, or intent.
- **Supabase continuity and shared presence:** the browser client now supports authenticated private continuity, opt-in memory sync, connection requests, and Realtime presence. The migration and project configuration still need to be applied to the live Supabase project.
- **Resident inference:** a Supabase Edge Function now verifies the visitor, applies a per-user quota, and routes bounded scene cues plus an explicit message to a configured model provider. It is not a continuously running autonomous agent.
- **Peer execution runtime:** the core peer runtime is a job/execution mechanism, not a visitor-presence sensor or a character mind.

The UI's older `api/` and `server/` modules require a compatible server deployment. GitHub Pages does not execute those server routes. The new shared-world client and Edge Function are separate, purpose-built paths; they still require the Supabase setup described in `RESIDENT_RUNTIME_DEPLOYMENT.md`.

## Shared-world substrate

`db/002_shared_world_presence.sql` adds authenticated connection requests and an expiring presence projection. Presence visibility is `private`, `connections`, or `public`; connection-only visibility requires an accepted relationship. The schema publishes the presence table to Supabase Realtime when the standard publication is available. It deliberately stores no microphone envelope, pointer coordinates, transcripts, inferred mood, or private continuity content.

The browser-side shared-world client and entry panel are implemented. They use Supabase Auth magic links, a public anon key, Realtime Postgres Changes, expiring heartbeat presence, and explicit private/connections/public visibility. Visitors can share a connection code, send requests, accept or decline incoming requests, cancel pending requests, and revoke accepted connections. Either participant can end an accepted connection. Private continuity sync is off by default and requires an explicit visitor choice; it is disabled on sign-out. Use of that private memory by the resident model is a second, separate opt-in. This is a connection path, not proof of a live connection. The four SQL migrations (`db/001` through `db/004`) must still be applied to the actual Supabase project, and the GitHub repository must supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Actions variables. The deployed build must then pass the shared-world smoke test. GitHub Pages does not execute the repository's `api/` serverless routes. No service-role key may be placed in browser code.

## Perception roadmap

1. **Local interaction sensing** — pointer, dwell, stillness, focus, visibility, and consented acoustic envelope.
2. **Observation provenance** — implemented as a bounded, ephemeral, local-only ledger.
3. **Character response policy** — map observable signals to bounded visual/dialogue changes; no hidden emotional claims.
4. **Session continuity** — browser-local memory and optional RLS-protected account memory sync are implemented; account sync is off by default, opt-in, and disabled on sign-out.
5. **Shared presence** — browser client, sign-in, connection requests, visibility controls, Realtime subscription, and heartbeat code are implemented; live operation still depends on applying the migration, configuring GitHub Actions variables and Supabase redirect allowlists, and verifying cross-user behavior.
6. **Model-backed resident dialogue** — client bridge, authenticated Edge Function, bounded in-session history, and scene-cue payload are implemented in source; live replies require the Edge Function to be deployed and `MODEL_API_URL`, `MODEL_API_KEY`, `MODEL_NAME`, and allowed origins configured in Supabase. Tazar and Jello share the same short-lived, in-browser conversation thread; each assistant turn is labelled with the resident who spoke, so one can pick up the other's part of the scene. This thread is not written to account memory or a server transcript.
7. **Perception-to-agent bridge** — bounded cues now flow from the local ledger through the response policy into resident model requests. It does not pass raw audio, coordinates, or psychological inferences.

## Release truth

A source-level contract test is not a browser test. A committed workflow is not a passing build. A successful build is not proof that the published Pages URL serves the same commit. These are separate verification stages and must be reported separately.
