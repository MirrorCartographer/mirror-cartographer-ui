# Phone-first composition capability cycle — 2026-07-09

## Read first

Current next-action source: `docs/cycles/2026-07-09-composition-cycle.md` and `scripts/run-phone-gates.mjs`.

The prior cycle said the site should not add another instrument yet. It should first establish a stable command that can be run before creative changes.

## Evaluation

Strongest current need: better testing route.

Priority order this cycle:

1. Testing route / phone contract.
2. Build verification.
3. Composition structure.
4. Audio-visual coupling.
5. Weather mapping.
6. Instrument design.
7. Hosting changes.

The existing runner only executed the static phone contract and then pointed to the browser smoke gate. That was useful but incomplete: a static contract can pass while the app fails to compile.

## Host/repo verdict

Keep Vercel as the primary host for now.

The current repository setup is helping iteration because small source and docs writes are succeeding. Vercel remains appropriate while the app is still a Vite/React experiment with a simple deployment path.

Do not migrate yet.

Cloudflare Pages is still the best parallel preview candidate later if live visual confirmation stays difficult. Netlify is not a clear enough improvement. GitHub Pages adds routing/build friction and should not be the next move.

A separate stable repo is premature. A stable branch or preview branch would be useful only after the phone gate command is routinely run.

## View/test route

The available concrete route is repository-side:

- `node scripts/run-phone-gates.mjs`
- `npm run test:smoke` where Playwright browser execution is available

Public URL verification was attempted through the available web open path but the tool rejected direct opening of the known Vercel URL because it was not present in a current search result. Search did not surface the deployment.

## Implementation result

Updated `scripts/run-phone-gates.mjs` so the stable gate now runs:

1. `node scripts/phone-contract-check.mjs`
2. `npm run build`

This improves confidence without touching `package.json`, without adding visible words, and without changing playback behavior.

## Next suggested action

Run:

`node scripts/run-phone-gates.mjs`

If it passes, run:

`npm run test:smoke`

If both pass, the next implementation should add `src/engine/compositionClock.js` as a small pure module, not yet a new instrument. It should expose deterministic phase/pulse/measure values that visuals and audio can share after tap-to-start.

Do not add counterpoint, phrase memory, or new weather mappings until the shared clock exists and the phone gates pass.
