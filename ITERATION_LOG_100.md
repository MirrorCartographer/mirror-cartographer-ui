# 100-iteration improvement log — Mirror Cartographer UI

**Target:** 100 distinct inspect → change/test → verify → record cycles.  
**Completed:** 13/100 (artwork-only hue transformation, first-contact touch capture, refresh-rate-independent motion, and pointer-cancellation recovery; Smoke Test run #4269 and Static Preview Artifact run #4234 passed).  
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


## Iteration 007 — Measure semantic interaction outcomes locally

- **Observation:** The observatory recorded clicks and later inferred outcomes from route changes or total DOM-size changes. A button could change its actual state (for example, `aria-pressed=false` to `true`) without changing DOM size, so the event could be mislabeled as having no observed effect.
- **Change:** Added a privacy-minimal state snapshot of selected accessibility/state attributes, disabled state, and checkbox/radio state. Interaction outcomes now distinguish route changes, semantic state changes, DOM-size changes, and no observed change. No text-input values or free-form content are recorded. Added a browser regression test for the sound toggle.
- **Verification:** The prior hosted run #4090 passed the full phone-first browser gate and all room interactions. The new telemetry outcome test requires a fresh hosted run.
- **Risk:** The telemetry remains browser-local in localStorage; it does not report usage to a server or provide cross-user analytics. The 900 ms observation window can miss delayed effects.


## Iteration 008 — Correct the Observatory's dead-end classification

- **Observation:** The Observatory dashboard counted every button with no `href` as a potential dead end. That is a false positive: buttons are action controls and normally do not have link destinations. The dashboard also did not surface the new semantic state-change outcomes as a headline metric.
- **Change:** Only anchor elements without a real destination are now classified as potential dead ends. Added a semantic-state-change metric and updated the interpretation boundary. Added a browser test that toggles a button, observes a state change, and verifies the button is not reported as a dead link.
- **Verification:** The preceding UI run #4095 passed all 10 room tests, including semantic telemetry. This dashboard-specific regression test requires a fresh hosted run.
- **Risk:** This remains local-only telemetry and cannot tell us how visitors on other devices behave unless they voluntarily export and share their local evidence.


## Iteration 009 — Preserve route-transition outcomes across navigation

- **Observation:** The interaction observer waited 900 ms before recording an outcome. A real navigation unloads the source page before that timer runs, so the click was retained but the successful route transition could be lost.
- **Change:** Same-origin anchor interactions now place a short-lived pending record in sessionStorage. The destination page confirms the transition and writes the outcome to localStorage. Pending records expire after 30 seconds and are cleared after resolution. Empty anchor hrefs are now treated as placeholders.
- **Verification:** GitHub Actions Smoke Test run #4105 passed the full local phone-first gate, including 12 browser tests and cross-page route confirmation. Atlas Source Validation run #425, room integrity #47, field instrument #28, and machine checks #3613 also passed.
- **Risk:** Only same-origin route transitions are confirmed. External navigation cannot be followed across origins, and a browser crash before the destination loads may leave an unresolved pending record until expiry.


## Iteration 010 — Keep spectral transformations on the artwork surface

- **Observation:** The room transformation applied `hue-rotate` to the entire document body. This recolored navigation, labels, buttons, and focus indicators along with the canvas artwork, so an artistic transformation could silently alter interface contrast and control affordances.
- **Change:** Moved the hue filter to the room canvas only. Updated the browser regression test to require the canvas transformation and reject a body-level filter.
- **Verification:** GitHub Actions Smoke Test run #4256 passed, including the phone-first gate and room-route/browser suite; Static Preview Artifact run #4221 passed.
- **Risk:** Canvas artwork changes hue while DOM controls retain their designed colors. Room-specific canvas contrast still requires visual review across all ten room palettes.

 
## Iteration 011 — Capture the first touch coordinate

- **Observation:** The shared room engine updated pointer coordinates only on `pointermove`. A touch interaction can begin with `pointerdown` before any move event, so the first tap could be recorded and rendered at the stale center/previous pointer location rather than where the user touched.
- **Change:** The pointer-down handler now captures and clamps the initial contact coordinates before recording the gesture. Added a minimal read-only pointer probe to the existing room test hook and a regression test that dispatches a touch pointer-down without a preceding move.
- **Verification:** GitHub Actions Smoke Test run #4261 passed the phone-first and room browser suite, including the initial-touch-coordinate regression test.
- **Risk:** The regression test uses a synthetic pointer event. Physical-device touch behavior still warrants a real-device check.

 
## Iteration 012 — Make room motion independent of display refresh rate

- **Observation:** The procedural room clock advanced by a fixed amount per animation frame. A 120 Hz display therefore ran the artwork approximately twice as fast as a 60 Hz display, while slower devices produced slower motion.
- **Change:** Replaced per-frame increments with elapsed-time advancement, preserving the prior 60 Hz speed and clamping long frame gaps to avoid large jumps after tab suspension. Added a deterministic browser test comparing equal elapsed time at 60 Hz and 120 Hz.
- **Verification:** GitHub Actions Smoke Test run #4265 passed the 60 Hz/120 Hz elapsed-time regression and full phone-first/room suite; Static Preview Artifact run #4230 passed.
- **Risk:** The time clamp intentionally discards unusually long frame gaps. Physical-device motion perception and reduced-motion preferences still need dedicated review.

 
## Iteration 013 — Release pointer state after cancelled gestures

- **Observation:** The room engine released pointer state on `pointerup` only. A cancelled touch, lost pointer capture, or window blur could leave the gesture marked as active after the operating system interrupted it.
- **Change:** Added a shared pointer-release handler for `pointerup`, `pointercancel`, `lostpointercapture`, and window blur. Extended the read-only pointer probe and added a browser regression test for a cancelled touch.
- **Verification:** GitHub Actions Smoke Test run #4269 passed the cancelled-touch regression and full phone-first/room suite; Static Preview Artifact run #4234 passed.
- **Risk:** Synthetic cancellation verifies event handling; physical-device interruption and OS gesture arbitration still need device testing.
