# Composition capability cycle — 2026-07-09 — clock primitive

## Current suggested next action read

The most recent cycle note said to run the phone gates and, after verification is clean, add `src/engine/compositionClock.js` as the shared event stream for visuals, touch, audio, and weather.

The repo already contains:

- `scripts/run-phone-gates.mjs`
- `scripts/phone-contract-check.mjs`
- `tests/smoke.spec.js`
- `playwright.config.js`
- package scripts for phone contract, smoke, live, and gate checks

## Evaluation

Strongest current need: composition structure, but only as a safe primitive.

The site already has playback, phrase memory, counterpoint, weather mapping, and gesture visuals. The risk is that those layers remain coupled by informal local state instead of a shared compositional clock. Adding another instrument would increase complexity without improving control.

## Host/repo verdict

Keep Vercel as the primary host for now.

The repo is helping iteration: source writes and docs writes succeeded in this cycle. Vercel is still appropriate for the public phone-first app. Cloudflare Pages remains useful later as a parallel preview host if Vercel deployment visibility becomes the bottleneck. Netlify and GitHub Pages do not currently offer enough advantage to justify migration churn.

## View/test attempt

The public Vercel URL was not available through the current web open path because the URL was not returned by search in this run. That means live visual verification is still not available from this tool path.

Best available concrete test route remains repository-side:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`
3. `npm run test:live` if a live URL is configured and browser execution is available

## Implemented

Added `src/engine/compositionClock.js`.

The clock is intentionally browser-global-free and does not touch autoplay, DOM, visible text, or rendering. It exposes:

- beat
- bar
- phrase
- phase
- energy
- tap count
- last tap time

Updated `scripts/phone-contract-check.mjs` to assert that the composition clock exists and remains independent of browser globals.

## Next suggested action

Run `node scripts/run-phone-gates.mjs` in an execution environment.

If it passes, wire the composition clock into `App.jsx` in the smallest possible way:

1. create one `clockRef` in `App`;
2. call `clockRef.current.tap(...)` inside the existing pointer interaction;
3. pass the resulting snapshot to music start/pulse;
4. optionally add the snapshot to the canvas environment;
5. do not add visible copy, autoplay, new controls, or extra instruments.

If the gate fails, fix only the failing gate before composition wiring.
