# 100-iteration improvement log — Mirror Cartographer UI

**Target:** 100 distinct inspect → change/test → verify → record cycles.  
**Completed:** 6/100 (canonical contract, workbench/index repairs, syntax repairs, deployment-relative source parity gate, and functional spectral-shift control).  
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
- **Verification:** GitHub Actions run #21 passed the field-instrument release gate; run #4088 passed the HTML-index gate and full phone-first local gate.
- **Risk:** This is source-level repair. It does not establish browser interaction quality or deployment of the changed source.


## Iteration 003 — Repair procedural carnival renderer syntax

- **Observation:** After the Constellation and index repairs, the hosted phone-first gate progressed further and exposed another parse failure in `public/atlas/rooms/experiments/engine.js:74`. A template literal had been stored with escaped backticks and interpolation markers, making the shared room engine invalid JavaScript.
- **Change:** Restored the actual template literal in the carnival renderer.
- **Verification:** The failure was directly reproduced by the hosted route syntax checker. A subsequent route and browser run must confirm all room routes parse and interact.
- **Risk:** This repairs syntax only; visual quality and all room-specific behaviors still require browser inspection.


## Iteration 004 — Repair observatory route normalization

- **Observation:** The next hosted room-route pass progressed past the carnival renderer and exposed an invalid regular expression in `public/atlas/rooms/mc-observatory.js`. The route-normalization expression used a malformed slash/backslash delimiter sequence.
- **Change:** Replaced it with a valid slash-collapsing regular expression.
- **Verification:** GitHub Actions run #4088 passed the full room-route and phone-first browser gate after this correction.
- **Risk:** This is a parse repair; route telemetry behavior and browser persistence still need direct testing.


## Iteration 005 — Correct the research-atlas parity gate

- **Observation:** Atlas Source Validation used byte-for-byte `cmp` between the source and published research-atlas copies. They intentionally differ in one relative link: the source copy links to `../public/atlas/`, while the published copy links to `../atlas/`. The test rejected the correct deployment-specific route.
- **Change:** Added a parity checker that verifies each route independently, normalizes only that one intentional path difference, and then requires all remaining bytes to match. Replaced the invalid `cmp` step in the workflow.
- **Verification:** GitHub Actions Atlas Source Validation run #418 passed after replacing the incorrect byte-for-byte comparison.
- **Risk:** This validates source parity and link intent, not the live deployed URL or deployment identity.


## Iteration 006 — Make the room's spectral-shift control visibly work

- **Observation:** The Playwright room test could activate the `shift` button but found no `hue-rotate` style on the body. The renderer advanced an internal hue value, but the visible scene had no whole-surface spectral transition.
- **Change:** The shared experiment engine now applies the updated hue as a body-level CSS filter during the transform action, while retaining the phase update and renderer redraw.
- **Verification:** GitHub Actions run #4088 passed the full phone-first gate, including the spectral-shift browser assertion and remaining room controls.
- **Risk:** Body-level hue rotation affects all content in the room, including controls; visual contrast and accessibility should be checked in-browser.
