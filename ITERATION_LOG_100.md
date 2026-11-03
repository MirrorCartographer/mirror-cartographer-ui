# 100-iteration improvement log — Mirror Cartographer UI

**Target:** 100 distinct inspect → change/test → verify → record cycles.  
**Completed:** 3/100 (canonical contract, Constellation syntax/index repair, and procedural room renderer syntax repair).  
**Branch:** `work/100-iterations-2026-11-03`

## Iteration 001 — Enforce canonical experience and deployment-state invariants

- **Observation:** The repository correctly records two protected Vercel URLs and an unresolved deployment-identity blocker. That state should be guarded against accidental wording or metadata drift.
- **Change:** Added `scripts/cross-repo-experience-contract-check.mjs` and wired it into `test:local-gate`. It checks both canonical URLs and requires the deployment state to remain explicitly blocked until exact deployed-commit evidence exists.
- **Expected proof:** `npm run test:cross-repo-contract` passes.
- **Verification status:** CODE-ONLY. This test has not yet been run in GitHub Actions or a local checkout.
- **Risk:** This is a repository contract check, not a browser test. It does not establish that either live site is currently reachable or that current source is deployed.

## Remaining iteration areas (002–100)

- 002–010: Route inventory, link integrity, route-specific browser tests, deep-link and refresh behavior.
- 011–020: Door/button action completeness and dead-control detection.
- 021–030: Room uniqueness, progression, unlock/reset paths, and state persistence.
- 031–040: Sensory interaction, audio routing, mute/gain, and device evidence.
- 041–050: Mobile/touch, keyboard, screen-reader, and reduced-motion behavior.
- 051–060: Workbench open/edit/run/reset/export round trips.
- 061–070: Procedural art diversity, deterministic rendering, and performance budgets.
- 071–080: Local memory, privacy boundaries, import/export, and recovery.
- 081–090: Deployment identity, exact-commit provenance, preview isolation, and rollback.
- 091–100: Cross-repository integration, live browser verification, usability evidence, and release acceptance.

**Counting rule:** A pass counts only when it has a distinct target, evidence, a concrete change or test, and a recorded outcome. Neither a source path nor an HTTP 200 alone proves the deployed experience is the intended build.


## Iteration 002 — Repair the Constellation instrument and workbench inventory

- **Observation:** Hosted UI checks found a literal escaped newline between two JavaScript declarations in the Constellation instrument. Node syntax checking failed. The same run found four real HTML files absent from both workbench indexes (92/96 coverage).
- **Change:** Replaced the literal escape with a real source newline; added all four missing HTML paths to both workbench indexes and updated their count to 96.
- **Verification:** The failures were directly reproduced in GitHub Actions. A subsequent hosted run must pass the field-instrument syntax audit and workbench-index gate.
- **Risk:** This is source-level repair. It does not establish browser interaction quality or deployment of the changed source.


## Iteration 003 — Repair procedural carnival renderer syntax

- **Observation:** After the Constellation and index repairs, the hosted phone-first gate progressed further and exposed another parse failure in `public/atlas/rooms/experiments/engine.js:74`. A template literal had been stored with escaped backticks and interpolation markers, making the shared room engine invalid JavaScript.
- **Change:** Restored the actual template literal in the carnival renderer.
- **Verification:** The failure was directly reproduced by the hosted route syntax checker. A subsequent route and browser run must confirm all room routes parse and interact.
- **Risk:** This repairs syntax only; visual quality and all room-specific behaviors still require browser inspection.
