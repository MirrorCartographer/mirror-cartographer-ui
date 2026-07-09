# Composition capability cycle — 2026-07-09 continuous clock coupling

## Read first

Recent cycle output said the next action was to run gates and then wire `createCompositionFrame` into `App.jsx` on the existing low-frequency tick.

Current repository inspection showed:

- `package.json` already has phone, smoke, live, and gate scripts.
- `scripts/run-phone-gates.mjs` already runs the phone contract and production build.
- `src/engine/compositionClock.js` exists.
- `src/engine/compositionFrame.js` exists.
- `src/components/App.jsx` imports `createCompositionClock`, but not `createCompositionFrame` yet.
- `App.jsx` still builds tap composition inline and the low-frequency interval only decays pulse/rhythm.

## Evaluation

Strongest need remains audio-visual composition structure, specifically continuous clock coupling after tap. The testing route is good enough to support one small compositional wiring step, because the static runner and smoke path now exist.

Priority order for this cycle:

1. Continuous composition frame projection.
2. Phone gate execution where available.
3. Playback repair only if gates reveal failure.
4. No new instruments yet.

## Host/repo verdict

Keep Vercel as primary. The repository is helping iteration: small source and docs writes are succeeding. Vercel is still the least-churn host for the current React/Vite app.

Cloudflare Pages is still a good later parallel preview host, but not a migration target until the gate path is regularly used. Netlify and GitHub Pages do not currently improve confidence enough to justify churn.

## View/test route

Concrete available route remains:

- `node scripts/run-phone-gates.mjs`
- `npm run test:smoke`
- `npm run test:live` when the public deployment is reachable from a browser-capable environment

No public browser screenshot was available in this tool run.

## Implementation result

Implemented the smallest safe code-side step toward the next action:

- expanded `src/engine/compositionFrame.js` with `createTapCompositionFrame(clock, input)` so tap composition and continuous snapshot composition can use the same shape.

This does not add visible words, autoplay, new instruments, or heavier scheduling.

## Next suggested action

Wire both frame helpers into `App.jsx`:

1. import `createCompositionFrame` and `createTapCompositionFrame`;
2. replace inline tap composition construction with `createTapCompositionFrame`;
3. update the existing low-frequency interval to call `createCompositionFrame(clockRef.current, { state, pulse: nextPulse, rhythm: nextRhythm })` after decay;
4. run `node scripts/run-phone-gates.mjs`;
5. then run `npm run test:smoke` where Playwright execution is available.

Do not add instruments until this clock projection is visible and stable after tap.
