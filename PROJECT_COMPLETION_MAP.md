# Project completion map — Mirror Cartographer UI

**Updated:** 2026-11-04  
**Purpose:** Canonical status ledger for intended UI, atlas, room, workbench, and release work. This is an evidence ledger, not a claim of completion.

## Production spine

- Root entry: `index.html` → `src/main.jsx` → `src/App.jsx` / `RoomWorldValid`.
- Foundational room definitions and palette data: `src/world/roomCatalog.js`.
- Shared room encounter engine: `public/atlas/rooms/experiments/engine.js`.
- Shared public art direction: `public/art-direction.css`; source counterpart: `src/assets/art-direction.css`.
- Main room directory: `public/atlas/rooms/index.html`.
- Experiment-room directory and ten procedural room entries: `public/atlas/rooms/experiments/index.html` and `001-observatory` through `010-composer`.
- Public workbench: `public/workbench.html`; root development workbench: `workbench.html`. Both indexes must cover every tracked HTML file and avoid stale/duplicate paths.
- Quality gates: `tests/rooms.spec.js`, `tools/validate-workbench-index.mjs`, `scripts/rooms-route-check.mjs`, Atlas source checks, room encounter integrity, build and live-route workflows.

## Evidence-backed changes in this pass

- Both workbench indexes now include the four previously omitted HTML experiences: the Research Atlas, Signal Loom game 11, standalone Observatory, and The Living Country. The workbench validator confirms all 96 HTML artifacts are indexed.
- The shared experiment-room transform now produces a visible hue shift, not only an internal phase change.
- Fixed the observatory route normalizer's malformed regular expression and The Living Country's nonexistent `draw()` call, which is now `drawWorld(0)`.
- Integrated the hand-authored `public/art/atlas-carnival.svg` into the Carnival of Thought directory card; a browser test verifies the artwork actually loads.
- Fixed a literal escaped newline in the Unfinished Constellation inline script. The Field Instruments release gate now parses the script and builds successfully.
- Synchronized the source and published Research Atlas pages; the relative stylesheet works in both contexts and Atlas Source Validation passes.
- Added opt-in, per-room local memory to the ten procedural rooms. The default is one-off; saved phase/gesture/hue and up to 36 traces restore on reload; “forget trace” clears local state. This is browser-local storage, not encryption or cross-device sync.
- Hardened the active root room-world progress store: malformed saved room IDs, depths, energy, and gesture arrays are sanitized before use; blocked localStorage writes no longer crash the encounter and produce a visible accessible non-persistence warning. The room-world contract check now asserts these boundaries; browser-level denial testing remains open. Hover-only pointer movement no longer increments progression or unlocks rooms; the room-world contract check asserts that gate. The room constellation dialog now contains Tab/Shift+Tab focus and closes on Escape, returning focus to its opener.
- Updated the room identity manifest to reflect the new memory behavior without claiming that the deeper room-specific interaction grammars are complete.
- Expanded the browser smoke test to derive destinations from all 34 entries in `room-identities.json`, in addition to standalone routes. It checks route responses, internal links, visible button activation, and browser runtime errors. Added a dedicated Signal Loom puzzle completion/reset test and a memory opt-in/restore/erase test.
- Added a CI check that requires `public/art-direction.css` and `src/assets/art-direction.css` to remain byte-identical.
- Added a `workflow_run` trigger so a successful GitHub Pages publication is followed by a live-site verification, rather than relying only on a check that may run before deployment.

## Verified release evidence

The latest release candidate passed on commit `94e5dc0bc72cfcba6fb85ece95b4da2e5ca09f19`:

- [Smoke Test: local gate, all 34 manifest destinations, room controls, memory privacy, Signal Loom, and Carnival artwork](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764490217)
- [Publish interactive application to GitHub Pages](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764489431)
- [Post-deploy live Atlas verification](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764624032)
- [Field Instruments release gate](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41763620985)
- [Working Machine Checks](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764489684)
- [Static Preview Artifact](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764489716)
- [Room encounter integrity](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764475952)
- [Atlas Source Checks](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41764475722)

The live GitHub Pages deployment is verified at https://mirrorcartographer.github.io/mirror-cartographer-ui/atlas/. This is **not** evidence that the separate Vercel deployment is current; Vercel remains unverified in this pass.

## Completion criteria

A route or room is not complete merely because it returns HTTP 200 or paints a canvas. For every experience, verify:
1. Route loads at the intended base path and its internal links resolve.
2. Primary controls produce visible and semantically correct state changes.
3. Keyboard and touch interaction work; focus is visible; reduced-motion and sensory controls behave.
4. Reset, navigation, export/save, and completion/recovery paths work where applicable.
5. Browser console/page errors are absent in the tested path.
6. Any persistence is explicit, scoped, and documented.
7. The same build that passes tests is the build published; live routes are checked after publication.

## Remaining work — ordered by proof gate

### P0 — Release correctness
- [x] Complete the latest smoke test and diagnose the observed runtime and script-syntax failures.
- [x] Confirm Working Machine Checks and static preview artifacts on the same release commit.
- [x] Confirm GitHub Pages publication and a post-deploy live route verification.
- [x] Run the full local gate and room tests; preserve run links and commit SHA above.

### P1 — Experience integrity
- [ ] Audit every curated destination in the 34-room directory individually, including its identity, route, controls, empty/error states, and return path.
- [ ] Audit all 79 procedural room configurations for meaningful differentiation, not just palette changes.
- [ ] Check every visible link, button, menu, and navigation door for a real outcome; mark intentional external or inert affordances explicitly.
- [ ] Verify phone, keyboard-only, screen-reader semantics, reduced-motion, sound-off defaults, and local persistence behavior.
- [ ] Validate that the Observatory reports only observations it can actually collect and explains its local-origin boundary.

### P1 — Product coherence
- [ ] Connect the Field Guide, Cabinet, Observatory, Self Cartographer, art machine, independent web experiences, veteran hub, and research tools into a coherent navigation system without erasing their distinct identities.
- [ ] Make the distinction between production, research prototype, archived artifact, and planned concept explicit.
- [ ] Ensure all planned destinations are represented in an inventory and each has a stated acceptance test or an explicit deferred/retired status.

### P2 — Maintenance and architecture
- [ ] Establish the canonical production/deployment path and document legacy, research, and standalone runtimes.
- [ ] Review duplicate CSS and runtime entry points before deletion; remove only proven dead/duplicate code.
- [x] Keep the public and source art-direction CSS synchronized with an automated parity check.
- [ ] Preserve proof artifacts for each completion claim.

## Status vocabulary

- **Verified:** implementation and the relevant acceptance check passed on a named commit.
- **Implemented, unverified:** code exists, but acceptance evidence is missing.
- **Partial:** some acceptance criteria pass; meaningful behavior is absent.
- **Blocked:** external permission, credential, account setting, device, or dependency is required.
- **Deferred:** consciously excluded from the active completion target.
- **Not built:** only an idea, specification, or placeholder exists.

## Boundary

This file is not proof that the project is finished. Completion requires closing or explicitly deferring each applicable item above, then verifying the exact release candidate in browser and on the live deployment.
