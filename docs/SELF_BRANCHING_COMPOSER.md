# Self-Branching Composer

## Current branch decision

Revised the previous action into a contract-first gate. The recent work continued into phrase-density visual scoring, which is acceptable only if the phone contract protects it. Do not branch into a new host, new instrument, new visible explainer, or denser visuals until the reliability contract catches the coupling explicitly.

## Hosting assessment

Vercel remains useful as the primary atmospheric deploy surface when quota is available, but recent Vercel failures have been build-rate-limit signals rather than proven app regressions. GitHub Pages remains the best fallback because this repo already has `build:pages`, `test:pages-preview`, and `test:pages-remote`. Cloudflare Pages becomes the next serious fallback only if Pages cannot expose a stable built shell. Netlify is still lower priority. A separate stable repo is premature; if visible explainers or model demos keep leaking into `main`, split first by stable branch or gallery route.

## Live/testing check

Latest inspected main commit was `4c267023df7b43ad0a536a5d80ba59b92ad3c509` (`Record phrase-density visual score cycle`). GitHub workflow-run lookup returned no runs for that commit, so this connector still cannot prove that a push-triggered Pages run exists. The reliable verification path remains repo-side gates: `npm run test:phone-contract`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- low CPU before new visual density
- host failures must not be misread as product failures
- visual composition changes must be contract-protected before more novelty

## Change attempted in this cycle

Attempted the smallest implementation patch: add `scripts/phone-contract-check.mjs` assertions proving that `drawVisualScore` reads `clock?.phrasePhase` and `clock?.density`, and that `compositionFrame` exposes `density: shape.density` plus `phrasePhase: shape.phrasePhase`. The GitHub write was blocked by the safety layer before commit, so the fallback was to record this exact gate here instead of adding novelty.

## Next suggested action

Make a smaller code patch to `scripts/phone-contract-check.mjs`: define a `visualScore` source slice from `function drawVisualScore` through `function useWordlessSky`, then add two assertions only:

1. `visualScore` contains `clock?.phrasePhase` and `clock?.density`.
2. `src/engine/compositionFrame.js` contains `density: shape.density` and `phrasePhase: shape.phrasePhase`.

After that, run `npm run test:phone-contract`. If it passes, run `npm run test:pages-preview`; then run `npm run test:pages-remote`. Do not alter visuals, audio, copy, hosting, or architecture until those gates pass.

## Later branch

After phone contract and Pages remote both pass, add a Pages or Vercel screenshot/browser proof route. If visible explainers or model demos remain useful, route them away from the stable phone-first instrument with a separate experimental branch or gallery route before creating a separate stable repo.
