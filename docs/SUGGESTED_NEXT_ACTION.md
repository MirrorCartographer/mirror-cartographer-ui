# Suggested next action

## Current best next move

Repair `useWordlessSky` so a hidden document stops scheduling canvas frames and visibility restoration starts exactly one animation loop.

The phone contract now distinguishes between merely skipping drawing and actually pausing animation scheduling. The current implementation still calls `requestAnimationFrame(loop)` while `document.hidden`, so the new contract should fail until the runtime is repaired.

## Why this is next

This is a concrete phone reliability defect:

- hidden tabs still wake the animation callback
- repeated visibility transitions need explicit single-loop ownership
- the fix can remain isolated to canvas scheduling
- no audio behavior, visible words, interaction semantics, or visual design must change

Do not wire `fieldEncounter` or add another decorative layer during this repair.

## Required runtime shape

Inside `useWordlessSky`:

- the loop must clear its active RAF marker when entered
- when `document.hidden`, return without scheduling another frame
- the visibility handler must cancel and clear an active frame when hidden
- when visible, resize and request a frame only when no frame is already active
- cleanup must cancel the active frame and remove both listeners

## Preserve

- no autoplay
- tap-to-start only
- no visible explanatory copy
- no audio changes
- no duplicate animation loops
- reduced-motion safety
- existing canvas output while visible
- GitHub Pages as canonical static fallback
- Vercel as secondary while build-rate limits persist

## Test route

Run:

- `npm run test:phone-contract`
- `npm run build`
- `npm run test:smoke`
- `npm run test:pages-preview`

Then inspect the Pages deployment and live remote gate.

## Hosting/testing gate

- GitHub Pages remains the current canonical static deployment path because `pages-preview.yml` builds, deploys, and live-verifies.
- Vercel remains suitable for branch previews when quota is available, but rate-limit status must not be treated as an app regression.
- Cloudflare Pages is the next hosting branch only when edge/state behavior is introduced or Pages reliability repeatedly fails.
- Netlify does not currently solve a distinct problem.
- A separate stable repo remains unnecessary while the canonical workflow and rollback branch exist.

## Next action after repair

After the hidden-tab contract, local smoke, and Pages gate are green, allow one small capability patch. The preferred patch is to wire `fieldEncounter` into visual pressure only, with no visible text and no audio coupling.
