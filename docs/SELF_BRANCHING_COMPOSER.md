# Self-Branching Composer

## Current branch decision

Follow the stability path. The previous requested contract patch has already landed: recent commits show phrase-density visual coupling protection, phrase-memory score checking, and Pages preview wiring. Do not repeat that work or branch into a new visual layer yet. The correct move is to treat the current handoff as a deployment/reliability gate before any novelty. This cycle added one package-level gate alias so the next run has a single command for the local-plus-Pages-preview path.

## Hosting assessment

Vercel remains suitable as the atmospheric primary host when build quota is available, but recent Vercel failures should still be classified as quota/build-rate-limit risk unless a reachable app shell proves otherwise. GitHub Pages is currently the strongest fallback because the repo has a dedicated Pages workflow that builds with the Pages base path, uploads the Pages artifact, deploys it, and then runs a live remote gate against the deployed URL. Cloudflare Pages remains the next serious fallback if GitHub Pages cannot expose a stable built shell. Netlify remains lower priority because it would add another hosting surface without improving the existing gate. A separate stable repo is still premature; prefer protected branches or a separate experimental route first.

## Live/testing check

The workflow itself now encodes the hosting/testing gate: `test:pages-preview` runs before artifact upload, then `test:remote-gate` runs after deployment using the deployed Pages URL. The remote gate probes candidate URLs for a real Vite/React shell, rejects Vercel limit/dashboard pages, verifies bundled canvas/audio/React signals, and then runs the Playwright live smoke test against the selected URL. Public URL fetch from this run was inconclusive because the web fetch tool could not open arbitrary URLs that were not discovered from search results; do not treat that as live-site failure.

Reliable gate order is now:

1. `npm run test:composer-cycle`
2. GitHub Pages workflow deploy
3. `npm run test:remote-gate` using the deployed Pages URL

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- low CPU before new visual density
- host failures must not be misread as product failures
- visual composition changes must be contract-protected before more novelty
- every run must include a hosting/testing gate

## Change made in this cycle

Committed `e53e155dc2d430b267fd609348efdb291618f3aa`: added `test:composer-cycle` to `package.json`, chaining `test:local-gate` and `test:pages-preview`. This keeps the next capability cycle from skipping the local contract/build/smoke path before the Pages base-path build.

## Next suggested action

Run `npm run test:composer-cycle`. If it fails, fix the exact failing check or build error before adding novelty. If it passes, inspect the latest GitHub Pages workflow result for `Pages Preview`. If build, deploy, and live verification pass, make exactly one tiny sensory improvement: let phrase contour subtly influence score-note spacing only. Do not couple it to audio in the same cycle. If the live Pages URL is unreachable but the build passes, branch to Cloudflare Pages only after recording the failing HTTP/status evidence.

## Later branch

After phone contract, Pages preview, and Pages remote all pass consistently, add a screenshot/browser proof route or artifact capture. Keep visible explainers and model demos away from the stable phone-first instrument by using a separate experimental route or branch before considering a separate stable repo.
