# Reexperience Engine V0

## Purpose

The Reexperience Engine is the layer that lets Mirror Cartographer become more than a pretty weather/music toy. It should let a visitor feel a compressed version of the system's origin story without requiring visible explanation, essays, labels, onboarding, or private chat exposure.

The goal is not to show biography. The goal is to let the surface behave as if it remembers pressure, interruption, return, repair, animal presence, weather, sound, and symbolic recursion.

## Constraints

- Phone first.
- No visible explanatory words.
- No autoplay violation.
- No crackle.
- No heavy CPU loop.
- No second canvas/rendering system unless a gate proves it is necessary.
- Keep the interaction clear: tap/press/drag changes the sky/music.
- Preserve maintainability: story data should be separated from rendering code.
- Preserve privacy: source beats must be abstracted and non-identifying unless intentionally public.

## First data shape

A reexperience seed should be plain JSON, importable at build time.

Required top-level fields:

- `version`
- `createdAt`
- `privacy`
- `beats`

Each beat should contain:

- `id`
- `sourceType`
- `timeBand`
- `capsule`
- `signals`
- `motifs`
- `feltWeather`
- `musicHint`
- `proofStatus`
- `privacy`
- `firstPassNote`
- `siteGesture`

## Site direction

The current site is visually pleasant but does not yet answer why someone stays. The next real creative direction is not more particles. It is narrative gravity.

A return visitor should feel that the site is slowly remembering how it became itself.

## Build-cycle status

The first seed JSON and validation script now exist. The app now imports `src/data/reexperience.seed.json` and turns recent story beats into subtle hidden weather marks, thread-lines, heart gravity, and glyph structure. This preserves the wordless surface: no visible explanatory text was added, audio still starts only from user tap, and the change reuses the existing canvas loop rather than adding a second renderer.

The local and live Playwright smoke gates now also instrument `requestAnimationFrame`. They assert that the wordless sky renders multiple animation frames before tap and continues rendering multiple frames after tap. This closes the prior harness gap: the tests no longer prove only that a canvas exists; they also prove that the animation loop remains alive on a phone-sized viewport.

## Hosting/testing assessment

Current best default host: Vercel, because the continuity anchor already names the live prototype there and the repo is a Vite/React static site with no backend requirement. Switching hosts now would add operational noise unless Vercel rate limiting or account interstitials repeatedly break the remote gate.

Safer branching path: for visual rewrites or risky audio changes, use a preview branch before `main`. For small data/render coupling changes like this cycle, `main` is acceptable if the local gate passes.

Fallback hosts:

- Cloudflare Pages: strongest alternate static host if Vercel preview reliability becomes poor.
- Netlify: good alternate for manual static deploys and simple previews.
- GitHub Pages: lowest-moving-parts fallback, but less ideal for phone-first preview iteration and branch preview ergonomics.

Known testing gap: CI status for the latest frame-survival patch still needs inspection. The current automation can read and write repo files, but did not get a workflow-run record for the newest spec commit.

## Suggested next action

Inspect GitHub Actions for the frame-survival commits. If the full `test:gate` is green, create a stable release marker and then tune story-beat influence so each beat affects composition/audio more distinctly without adding words. If the gate is red, fix only the failing test step; do not add novelty.
