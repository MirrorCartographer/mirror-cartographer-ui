# Composition frame cycle — 2026-07-09

## Sources read

- `docs/cycles/2026-07-09-composition-cycle.md`
- `docs/cycles/2026-07-09-clock-verification-cycle.md`
- `scripts/run-phone-gates.mjs`
- `scripts/phone-contract-check.mjs`
- `src/components/App.jsx`
- `src/engine/compositionClock.js`

## Current suggested next action

The previous note said to run `node scripts/run-phone-gates.mjs`, then make the smallest source change to advance `clockSnapshot` on the existing low-frequency tick after the first tap.

## Evaluation

The strongest need remains composition structure, specifically continuous audio-visual clock coupling after interaction. The app already has a shared `CompositionClock`, and the canvas reads `clockSnapshot`, but the snapshot is still produced at tap time. That means the visual score can read a stale beat/phase unless the user taps again.

The correct next move is not another instrument, phrase memory, or counterpoint. It is a safe projection seam that can let the existing tick produce a fresh composition frame without autoplay, text, or high-frequency React scheduling.

Priority order now:

1. Audio-visual coupling / composition structure.
2. Testing route.
3. Playback repair only if gates reveal failure.
4. Phrase memory and counterpoint later.
5. Hosting changes later.

## Host/repo verdict

Keep Vercel as the primary host.

GitHub writes are working. The repo setup is helping iteration because small source and gate files can be committed cleanly. Vercel is still adequate as the deployment target. Cloudflare Pages may become useful as a parallel preview host after the browser smoke baseline is trustworthy. Netlify and GitHub Pages do not improve the current blocker. A separate stable repo is premature.

## View/test attempt

The known Vercel URL could not be opened directly by the web tool because it was not present in a search result or the current user message. A search for the URL returned no result. No screenshot or live browser rendering was available in this cycle.

Concrete available test route remains:

- `node scripts/run-phone-gates.mjs`
- `npm run test:smoke` where Playwright/browser execution is available
- `npm run test:live` when the live URL is reachable

## Implementation result

Added `src/engine/compositionFrame.js`.

This file exports `createCompositionFrame(clock, input)`, a pure projector that converts a `CompositionClock.snapshot()` into the existing wordless composition shape:

- `state`
- `pulse`
- `rhythm`
- `beat`
- `phase`
- `phrase`

It uses no browser globals and does not start audio. It is intended to be called only from the existing low-frequency tick after the first tap has created a clock snapshot.

Updated `scripts/phone-contract-check.mjs` to guard the new projector.

## Commits

- `2ac374e` — added composition frame projector
- `20fcb7a` — guarded composition frame projector in phone contract

## Next suggested action

Run `node scripts/run-phone-gates.mjs`.

If it passes, wire `createCompositionFrame` into `App.jsx` inside the existing `PERFORMANCE_BUDGET.tickMs` interval. Boundary:

- update `clockSnapshot` only when it already exists;
- no autoplay;
- no new visible words;
- no new sound source;
- no high-frequency React timer;
- preserve tap-to-start;
- then run the phone gates again.
