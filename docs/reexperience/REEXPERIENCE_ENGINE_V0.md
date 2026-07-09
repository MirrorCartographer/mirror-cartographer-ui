# Reexperience Engine V0

## Purpose

The Reexperience Engine is the layer that lets Mirror Cartographer become more than a pretty weather/music toy. It should let a visitor feel a compressed version of the system's origin story without requiring visible explanation, essays, labels, onboarding, or private chat exposure.

The goal is not to show biography. The goal is to let the surface behave as if it remembers pressure, interruption, return, repair, animal presence, weather, sound, and symbolic recursion.

## Constraints

- Phone first.
- No visible explanatory words.
- No automatic sound on page load.
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

The first seed JSON and validation script now exist. The app now imports `src/data/reexperience.seed.json` and turns recent story beats into subtle hidden weather marks, thread-lines, heart gravity, and glyph structure. This preserves the wordless surface: no visible explanatory text was added, sound still starts only from user gesture, and the change reuses the existing canvas loop rather than adding a second renderer.

The local and live Playwright smoke gates instrument `requestAnimationFrame`. They assert that the wordless sky renders multiple animation frames before tap and continues rendering multiple frames after tap. The local smoke harness also samples the canvas center pixel before and after tap, so it can catch a blank-canvas regression rather than only proving that a canvas element exists.

A GitHub Pages preview workflow now exists. It installs the app, runs `scripts/run-phone-gates.mjs`, builds with the `/mirror-cartographer-ui/` base path, and deploys the static `dist` artifact to Pages when Actions/Pages are enabled.

## Hosting/testing assessment

Current best default host: Vercel. GitHub reports the newest commit with a successful Vercel status, and the continuity anchor already names the live prototype there. The repo is still a Vite/React static site with no backend requirement, so Vercel remains the least disruptive default path.

Different repository: not recommended. Moving the phone-first weather/music surface to a different repo would fragment continuity and make the existing Vercel integration less useful. A branch is better than a repository split for risky visual or sound changes.

Safer branching path: for visual rewrites, audio engine changes, or new input/import systems, use a preview branch before `main`. For small gate/doc/data changes, `main` is acceptable when static checks are preserved.

Fallback hosts:

- Cloudflare Pages: strongest alternate static host if Vercel preview reliability becomes poor.
- Netlify: good alternate for manual static deploys and simple previews.
- GitHub Pages: useful low-moving-parts fallback now that a workflow exists, but it depends on Actions/Pages being enabled and does not replace Vercel until its deploy is observed working.

Observed testing state: the connector could read the latest commits and GitHub reported Vercel success for `7ae882b333a8a9c258a753f26e31d097c40c24cc`. No GitHub Actions workflow run was visible for that commit through the available workflow-run connector. Public URL fetch was attempted but the web tool could not directly open the Vercel URL from this run, so live visual inspection remains unresolved.

Attempted high-leverage patch: add the same canvas-pixel assertion to the live-hosting Playwright spec and add reexperience validation to `scripts/run-phone-gates.mjs`. Both writes were blocked by the GitHub connector safety layer in this run, so this doc update records the next smallest safe action instead of pretending the gate changed.

## Suggested next action

First, retry the two small code patches separately in a normal interactive run or local environment: add `expectCanvasHasPixels` to `tests/live-hosting.spec.js`, and add `scripts/reexperience-validate.mjs` to `scripts/run-phone-gates.mjs`. Then inspect whether GitHub Actions/Pages runs after the next push. If Vercel remains green and Pages becomes visible, keep Vercel as primary and Pages as fallback. If Actions or Pages fail, fix only the workflow/gate path before adding any new visual behavior.
