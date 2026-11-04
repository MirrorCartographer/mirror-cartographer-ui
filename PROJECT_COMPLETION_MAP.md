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

- Workbench indexes were missing four existing HTML files. Both indexes were updated to include `public/atlas/research-atlas/index.html`, `public/atlas/rooms/arcade/connections/game-11.html`, `public/atlas/rooms/observatory.html`, and `public/atlas/rooms/worlds/the-living-country/index.html`.
- The index-validation step passed in the smoke run after the index change.
- Shared experiment-room transform now applies a visible `hue-rotate(...)` body filter in addition to updating room phase state.
- The following checks passed on commit `edff9e9f8bac1a65da13c59185e2da3eff60cd26`: Atlas Source Checks; Room encounter integrity; Verify Live Living Atlas on GitHub Pages; Project daemon.
- Static preview, Working Machine Checks, Smoke Test, and Pages publication were still running when this map was authored. Do not mark them passed until their run conclusions are available.

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
- [ ] Finish the latest smoke test after the workbench-index and room-transform fixes; diagnose and repair every failing assertion.
- [ ] Confirm Working Machine Checks and static preview artifacts on the same main commit.
- [ ] Confirm Pages publication and live route verification; do not infer deployment from a green build alone.
- [ ] Run the full local gate and all room tests; preserve run links and commit SHAs in the report.

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
- [ ] Keep the public and source art-direction CSS synchronized with an automated parity check.
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
