# Self-Branching Composer

## Current branch decision

Revise toward stability first, but do not freeze novelty forever. The latest repo handoff now supersedes the earlier phrase-contour note: phrase-density visual coupling protection, phrase-memory score checking, Pages preview wiring, and the composer-cycle alias have already landed. The safest next improvement is a tiny CPU/battery reliability patch: pause or heavily throttle the canvas animation loop while `document.hidden`, then protect that behavior with a static gate assertion before adding any sensory novelty.

## Hosting assessment

Vercel remains suitable as the atmospheric primary host when build quota is available, but recent Vercel failures should still be classified as quota/build-rate-limit or dashboard-shell risk unless a reachable app shell proves otherwise. GitHub Pages is currently the strongest fallback because the repo has a dedicated Pages workflow that builds with the Pages base path, uploads the Pages artifact, deploys it, and then runs a live remote gate against the deployed URL. Cloudflare Pages remains the next serious fallback if GitHub Pages cannot expose a stable built shell. Netlify remains lower priority because it would add another hosting surface without improving the existing gate. A separate stable repo is still premature; prefer protected branches, preview branches, or a separate experimental route first.

## Live/testing check

The workflow itself now encodes the hosting/testing gate: `test:pages-preview` runs before artifact upload, then `test:remote-gate` runs after deployment using the deployed Pages URL. The remote gate probes candidate URLs for a real Vite/React shell, rejects Vercel limit/dashboard pages, verifies bundled canvas/audio/React signals, and then runs the Playwright live smoke test against the selected URL. Public URL fetch from this runtime is weaker than the repo harness, so do not treat a connector/browser limitation as live-site failure without HTTP/status evidence from the harness.

Reliable gate order is now:

1. `npm run test:composer-cycle`
2. GitHub Pages workflow deploy
3. `npm run test:remote-gate` using the deployed Pages URL

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- no audio crackle regression
- low CPU before new visual density
- host failures must not be misread as product failures
- visual composition changes must be contract-protected before more novelty
- every run must include a hosting/testing gate

## Change made in this cycle

Recorded the hidden-tab stability gate decision in this handoff file. This is intentionally smaller than directly editing the canvas loop because the repo already contains a separate next-action note requiring both implementation and a static assertion; the next run should land both together so the behavior is testable.

## Next suggested action

Make exactly one reliability patch: in `useWordlessSky`, skip or slow the animation frame loop while `document.hidden`, resume cleanly on `visibilitychange`, and avoid touching audio start/pulse behavior. In the same commit, update `scripts/phone-contract-check.mjs` so it asserts the visibility behavior and also updates the existing `useWordlessSky(...)` signature check to include `phraseContour`. Then run `npm run test:composer-cycle`. If it passes and the Pages workflow deploys, run or inspect `npm run test:remote-gate` against the deployed Pages URL. If all gates pass, the next tiny novelty can be phrase contour influencing score-note spacing only, still with no audio coupling.

## Later branch

After phone contract, Pages preview, and Pages remote all pass consistently, add a screenshot/browser proof route or artifact capture. Keep visible explainers and model demos away from the stable phone-first instrument by using a separate experimental route or branch before considering a separate stable repo.