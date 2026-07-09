# Composition capability cycle — clock wiring

Status: active handoff after wiring the Composition Clock into the phone-first weather/music site.

## Read first

Recent cycle notes and repo state showed:

- `scripts/run-phone-gates.mjs` exists and runs the static phone contract plus production build.
- `src/engine/compositionClock.js` exists and exposes `createCompositionClock()`.
- The prior next action said to wire the clock into `App.jsx` only after the static gate path existed.

## Evaluation

The strongest need has shifted from testing-route creation to composition structure.

Priority order for this cycle:

1. Composition structure — now needed because the clock file existed but was not yet part of the live interaction path.
2. Testing route — still required after this change, through `node scripts/run-phone-gates.mjs` and then `npm run test:smoke` where browser execution is available.
3. Audio-visual coupling — next, but only by using the shared clock rather than creating ad hoc animation/audio timing.
4. Phrase memory/counterpoint — defer until the clock is verified in the app path.
5. Hosting/repository changes — defer; current GitHub writes are working and Vercel remains adequate.

## Host/repo verdict

Keep Vercel as the primary host for now.

The repo setup is helping iteration: source writes succeeded this cycle. A migration to Cloudflare Pages, Netlify, GitHub Pages, or a separate stable repo would add process churn before the static and browser gates are proven. Cloudflare Pages can remain a later parallel-host option if Vercel preview observability becomes the blocker.

## View/test attempt

The known Vercel URL could not be opened by the available web tool because it was not present in search results or the current prompt. Search for the URL returned no results. No screenshot/browser-rendering path was available from this cycle.

Concrete test route remains repository-side:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke` in an environment with Playwright browser execution
3. manual iPhone tap test on the Vercel deployment

## Implementation result

Implemented smallest source change:

- `src/components/App.jsx` now creates a `createCompositionClock()` instance.
- The first and later pointer taps still start audio only from user interaction.
- Touch gestures now create a clock snapshot and pass a shared composition payload into `skyMusic.start()` and `skyMusic.pulse()`.
- No visible explanatory words were added.
- No autoplay was added.
- No new instrument was added.

## Next suggested action

Run the gates:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke` where browser execution is available

If they pass, the next code cycle should let the visual layer read the same clock snapshot used by audio. The smallest safe follow-up is to pass a clock snapshot into the canvas env and use `clock.phase` or `clock.beat` for one subtle visual-score modulation. Do not add a new instrument, phrase memory, or counterpoint until the clock path is verified.
