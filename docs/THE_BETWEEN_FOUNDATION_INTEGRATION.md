# The Between — Foundation Integration Map

**Purpose:** preserve the original Foundation Intelligence Architecture beneath the Living World rather than allowing the visual experience to become a standalone character demo.

Mirror Cartographer is an application of the Foundation Intelligence Architecture (FIA), not a replacement name for it. The Between is one expressive environment inside that application.

## Architecture mapping

| FIA layer | The Between implementation | State |
|---|---|---|
| Reality / interaction | Pointer movement, touch/press, focus, page visibility, local microphone envelope, explicit dialogue choices, final submitted text | Browser signals wired |
| Reader / perception | Bounded observations with source, permission, timestamp, confidence, expiry, local-only scope, and ephemeral retention | Implemented in src/engine/perceptionLedger.js |
| Attention / figure-ground | residentResponsePolicy converts only permitted observations into a small scene-cue vocabulary | Implemented; deterministic |
| Intelligence kernel | Perceive → attend → interpret → respond loop | Partial; no general-purpose planner |
| Cognitive grammar | Literal dialogue, symbolic language, spatial scene cues, and distinct character voices | Expressed in the world; not yet a general translation engine |
| Knowledge / memory / evidence | Existing continuity_records; small private resident continuity record; explicit choice history | Private continuity bridge implemented; broader knowledge/evidence graphs remain in the Atlas |
| Translation boundary | Local-only signals; private account memory; accepted-connection visibility; public presence; explicit provider handoff | Scope boundaries implemented |
| Model router | OpenAI-compatible endpoint selected by server-side MODEL_API_URL and MODEL_NAME | Single replaceable provider adapter; no dynamic router |
| Execution layer | Supabase Edge Function resident-dialogue, Supabase Auth, Postgres, Realtime | Code implemented; deployment/configuration required |
| Applications | The Between, Atlas, Field, Workshop, research rooms | Existing application surfaces |

## Three kinds of continuity

### 1. Browser-local continuity

A browser-local visitor key supports return encounters on the same browser profile. It is not proof of a real-world identity and does not follow a visitor across devices.

### 2. Private account continuity

A visitor may sign in with a Supabase magic link and explicitly enable cross-device memory sync. Sync is off by default. The current private record is intentionally small:

- visit count;
- explicit in-world choices;
- last station event.

It does not contain microphone samples, pointer coordinates, submitted messages, transcripts, or inferred emotional states. The Memory Ledger lets the account owner inspect and remove saved choices or delete the account record.

### 3. Shared presence and relationships

A signed-in visitor may choose private, connections, or public presence. Presence expires after missed heartbeats. Connection requests require the other person to accept before connections-only visibility is granted. Either participant can revoke an accepted connection.

Shared presence is not permission to share private memory. These are separate systems and scopes.

## Perception contract

The scene can currently observe:

- normalized pointer position and approach;
- touch/press and keyboard focus;
- page visibility and window focus;
- stillness derived from pointer inactivity;
- a local microphone RMS envelope after an explicit browser permission grant;
- final text submitted to a resident;
- explicit dialogue-choice identifiers.

The observation ledger does not retain the text submitted to a resident. The text is sent only when the visitor presses Send. Raw microphone audio is not recorded or uploaded. No speech transcription, camera sensing, emotion detection, health inference, or real-world identity recognition is implemented.

A scene cue such as sound, approach-jello, or still describes an observable input. It is not a claim about what a visitor feels or intends.

## Tazar and Jello

Tazar and Jello are fictional inhabitants with distinct histories, roles, and voices. Their continuity can be linked to the visitor's consent-scoped account memory and the shared world without changing their fictional status.

The resident dialogue path supports:

- separate Tazar and Jello system profiles;
- bounded recent conversation turns held in page memory and sent with the current request;
- optional, consent-gated private continuity context;
- a replaceable OpenAI-compatible model endpoint;
- server-side provider credentials;
- no transcript persistence by Mirror Cartographer.

They are not autonomous agents. They do not run between visits, independently form beliefs, schedule actions, or operate tools. Those capabilities require a separate agent runtime, action permissions, durable journals, evaluation, and oversight.

## Deployment topology

- **Frontend:** GitHub Pages, unchanged as the public website host.
- **Identity and database:** the existing Supabase project, using the public anon key and row-level security.
- **Shared presence:** Supabase Realtime over the RLS-protected world_presence table.
- **Resident dialogue:** Supabase Edge Function resident-dialogue.
- **Model provider:** configured only through Supabase function secrets.

No Vercel deployment is required for this path. The repository's older serverless api/ directory is not executed by GitHub Pages.

## Activation and verification boundary

The source implementation is present, but live service operation still requires:

1. Apply db/001_continuity_records.sql and db/002_shared_world_presence.sql to the actual Supabase project.
2. Set GitHub Actions variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
3. Configure the Supabase Auth redirect allowlist for the GitHub Pages URL.
4. Deploy supabase/functions/resident-dialogue.
5. Set MODEL_API_URL, MODEL_API_KEY, MODEL_NAME, and ALLOWED_ORIGINS as Supabase function secrets.
6. Run the GitHub Pages build and verify authentication, RLS, realtime presence, connection transitions, and resident dialogue against the live project.

A committed migration is not an applied migration. A committed workflow is not a passing build. A passing build is not proof that the live Pages site is serving that commit.

## Next architectural work

1. Complete live Supabase activation and multi-account privacy tests.
2. Add a source-aware Memory Ledger for all durable memory classes, not only The Between's small continuity record.
3. Connect broader Atlas concept, evidence, decision, symbol, and project graphs through the same provenance model.
4. Add a replaceable model router with task-specific providers and local-model support.
5. Build the agent runtime separately from the characters: bounded goals, tool permissions, durable action journals, human approval gates, and replayable evaluations.
6. Add camera or speech perception only as separately consented, clearly described capabilities; neither is silently inferred from microphone amplitude.

The governing rule remains: the world may feel alive, but its mechanisms must remain legible, its memory revisable, and its boundaries real.
