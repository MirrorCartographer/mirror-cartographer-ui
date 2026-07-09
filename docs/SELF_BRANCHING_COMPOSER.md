# Self-Branching Composer

## Current branch decision

Followed the previous testing path rather than branching into a new host, route, instrument, or visible explainer. The site already made the phrase-density frame influence the wordless score; the strongest move was to protect that coupling in the phone contract so future composition cycles cannot accidentally decouple audio timing from visual breathing.

## Hosting assessment

Vercel remains useful as the primary atmospheric deploy surface when quota is available, but recent Vercel failures have been build-rate-limit signals rather than proven app regressions. GitHub Pages remains the best fallback because this repo already has `build:pages`, `test:pages-preview`, and `test:pages-remote`. Cloudflare Pages becomes the next serious fallback only if Pages cannot expose a stable built shell. Netlify is still lower priority. A separate stable repo is premature; if visible explainers or model demos keep leaking into `main`, split first by stable branch or gallery route.

## Live/testing check

The reliable verification path remains repo-side gates: `npm run test:phone-contract`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`. This connector can inspect source files and some GitHub workflow metadata, but public browser/screenshot proof is still not a reliable available route here. GitHub workflow-run lookup has also been unreliable for push-triggered Pages runs, so absence of a returned run should not be treated as deployment failure.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- low CPU before new visual density
- host failures must not be misread as product failures
- visual composition changes must be contract-protected before more novelty

## Change made in this cycle

Committed `d15e92d99e14e4488a65fdb453e66ddbbb35a489`: `scripts/phone-contract-check.mjs` now isolates the `drawVisualScore` source slice and asserts that it reads `clock?.phrasePhase` and `clock?.density`, then applies those values to score geometry through phrase-phase timing, base position, span, and density spread. This protects the last visual coupling change without adding visible words, autoplay, new instruments, or extra runtime work.

## Next suggested action

Run `npm run test:phone-contract` after commit `d15e92d99e14e4488a65fdb453e66ddbbb35a489`. If it fails, fix the exact assertion. If it passes, run `npm run test:pages-preview`; if that passes, return to composition behavior with one small phrase-memory move: let the existing contour memory influence either score note recurrence or audio motif return, but not both in the same cycle.

## Later branch

After phone contract, Pages preview, and Pages remote all pass, add a Pages or Vercel screenshot/browser proof route. If visible explainers or model demos remain useful, route them away from the stable phone-first instrument with a separate experimental branch or gallery route before creating a separate stable repo.
