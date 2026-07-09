# Composition capability cycle — 2026-07-09 frame wiring

## Read first

Recent commits showed the cycle had already moved from test-route construction into composition structure:

- runner and contract checks exist;
- `src/engine/compositionClock.js` exists;
- `src/engine/compositionFrame.js` exists;
- `src/components/App.jsx` had direct touch-clock coupling but was not yet using the frame projector on the low-frequency tick.

## Evaluation

Strongest current need: audio-visual coupling through composition structure.

Priority order this cycle:

1. continuous clock coupling after tap;
2. static phone contract coverage for that wiring;
3. browser/live verification;
4. phrase memory or counterpoint later.

Playback repair is not the next move because no new evidence shows broken tap-to-start. Instrument design and counterpoint should wait until the shared clock is verified in the app surface.

## Host/repo verdict

Keep Vercel as primary. The repo is helping iteration because source and contract writes both succeeded this cycle. Cloudflare Pages remains useful later as a parallel confidence host, but switching now would add deployment churn before the clock coupling has been verified. Netlify and GitHub Pages do not currently improve confidence enough to justify migration.

## View/test route

A direct public open of the known Vercel URL was blocked by the web tool because the URL was not present in current search results. Search also returned no public result. The concrete available test route remains repository-side:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`
3. `npm run test:preview-url` if a preview URL is supplied or exposed by deployment logs

## Implementation result

Implemented smallest feasible source change:

- `src/components/App.jsx` now imports `createCompositionFrame` and `createTapCompositionFrame`.
- Tap handling now uses `createTapCompositionFrame` instead of duplicating frame shape inline.
- The existing low-frequency tick now calls `createCompositionFrame` to keep the visual score advancing from the shared clock after the first tap.

Guarded with phone contract change:

- `scripts/phone-contract-check.mjs` now asserts the frame projector is imported, used inside the interval, and used inside the tap path.

Preserved constraints:

- no autoplay;
- audio start remains inside touch path;
- tap-to-start stays pointer-based;
- no visible explanatory copy added;
- existing phone-first canvas surface preserved.

## Next suggested action

Run gates before more composition work:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`

If both pass, add phrase memory as a tiny engine-only primitive. It should store the last few composition frames as numeric contour data only, with no UI text and no new instrument. Do not add counterpoint until phrase memory exists and passes the phone contract.
