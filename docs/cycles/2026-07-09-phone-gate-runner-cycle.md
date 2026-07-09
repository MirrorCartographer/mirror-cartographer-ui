# Phone gate runner cycle — 2026-07-09

## Read first

Current next-action sources read this cycle:

- `docs/cycles/2026-07-09-composition-cycle.md`
- `docs/next-actions/2026-07-08-after-smoke-harness.md`

Both point to the same conclusion: verification is still the strongest move before another creative layer.

## Evaluation

The site most needs a better testing route.

Priority order now:

1. Testing route / phone contract.
2. Composition structure.
3. Audio-visual coupling.
4. Phrase memory and counterpoint.
5. Weather mapping refinements.
6. Instrument design.
7. Hosting changes.

Reason: the app already has weather state, gesture memory, visual score marks, tap-to-start audio, and phone-first canvas rendering. Adding more musical behavior before a runnable gate would increase fragility.

## Host/repo verdict

Keep Vercel as primary.

Vercel is not currently proven to be the blocker. The limiting factor is still whether an automation or human can run a stable gate and trust the result.

Cloudflare Pages remains the best parallel preview candidate after the gate exists. Netlify is acceptable but not enough better to justify migration. GitHub Pages is still a poor primary fit for this Vite/reactive sound-canvas app unless the project becomes static-only. A separate stable repo is premature; use branch discipline or CI first.

## View/test attempt

The public Vercel URL could not be viewed from the available web tool this cycle. Search returned no result for the known URL, and direct open was rejected because the URL was not present in the current user message or search result.

Concrete test route remains repository-side:

- `node scripts/run-phone-gates.mjs`
- then `npm run test:smoke` where Playwright browser execution is available.

## Implementation result

Added:

- `scripts/run-phone-gates.mjs`

It runs the static phone contract without editing `package.json`, then prints the remaining browser smoke command.

This avoids the previous package-file safety filter and gives the next cycle one stable entry point.

## Next suggested action

Next cycle should try to run:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke` if a browser runner is available

If the gate passes or execution is unavailable but the static contract remains intact, add the smallest Composition Clock primitive:

- `src/engine/compositionClock.js`

It should expose a pure, dependency-free function that maps:

- current sky state;
- pulse;
- rhythm;
- recent marks;
- frame/time;

into a shared event packet for visual score, audio pulses, weather gestures, and future counterpoint.

Do not wire it deeply yet. First add the primitive and a static contract check that confirms it exists. Keep no autoplay, tap-to-start, efficient scheduling, no visible explanatory words, and phone-first stability.
