# Static syntax gate cycle — 2026-07-09

## Read first

Recent commits show the project already moved past phrase memory creation and into host/test reliability:

- `faf7b62` added the phrase memory primitive.
- `d316f69` guarded the phrase memory primitive.
- `feafbc3` recorded the phrase memory cycle.
- Later commits added live/default URL smoke paths, relative static asset base, and a portable static preview cycle.

The latest visible runner already executes:

1. phone contract;
2. production build;
3. printed follow-up commands for smoke/live browser gates.

## Evaluation

Strongest need this cycle: testing route.

Phrase memory exists, but wiring it into app behavior before a stronger gate would add stateful behavior to an already timing-sensitive phone surface. The app already has clock/frame coupling and a wordless visual score. The missing confidence layer is a cheap pre-build guard that catches syntax breaks in the pure engine files before the heavier build/browser path.

Priority order:

1. Testing route / verification.
2. Phrase memory wiring.
3. Audio-visual coupling refinement.
4. Counterpoint / instrument design.
5. Hosting changes.

## Host/repo verdict

Keep Vercel as primary.

Current repo setup is helping iteration: GitHub content writes are succeeding, commits are small, and the app now has repository-side static checks. Cloudflare Pages can remain a later parallel preview path, but switching hosts now would not fix the main gap: local/CI execution evidence. Netlify and GitHub Pages do not currently offer enough advantage to justify churn.

## View/test route

Attempted public URL path again using the known Vercel URL. The web tool still refused direct open because the URL was not present in current search results, and search returned no discoverable result. So live browser confirmation remains unavailable from this environment.

Concrete available test path remains:

- `node scripts/run-phone-gates.mjs`
- `npm run test:smoke`
- `npm run test:live` when a reachable URL/browser context is available

## Implementation result

Updated `scripts/run-phone-gates.mjs` to run `node --check` against the pure JavaScript/MJS gate-critical files before the contract and production build:

- `scripts/phone-contract-check.mjs`
- `src/engine/compositionClock.js`
- `src/engine/compositionFrame.js`
- `src/engine/phraseMemory.js`
- `src/engine/skyMusic.js`

Commit: `ff7f68a`.

## Next suggested action

Run:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`

If both pass, wire `createPhraseMemory` into `App.jsx` as an internal ref that records composition frames on tap and low-frequency ticks. Do not expose text, do not create autoplay, do not add instruments, and do not increase frame-loop work. Use the memory contour only as a tiny modulation source for existing visual score/audio pulse behavior.
