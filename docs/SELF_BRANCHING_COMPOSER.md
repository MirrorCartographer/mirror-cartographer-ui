# Self-Branching Composer

## Current branch decision

Stay on the stability path. The latest handoff correctly superseded the earlier phrase-contour novelty note: before adding sensory density, the phone-first site needed a CPU/battery reliability patch. This cycle implemented hidden-tab rendering throttling and protected it with the phone contract. Do not add visual novelty until the combined local and Pages gates pass.

## Hosting assessment

Vercel remains suitable as the atmospheric primary host when build quota is available, but recent Vercel failures should still be classified as quota/build-rate-limit or dashboard-shell risk unless a reachable app shell proves otherwise. GitHub Pages is currently the strongest fallback because the repo has a dedicated Pages workflow that builds with the Pages base path, uploads the Pages artifact, deploys it, and then runs a live remote gate against the deployed URL. Cloudflare Pages remains the next serious fallback if GitHub Pages cannot expose a stable built shell. Netlify remains lower priority because it would add another hosting surface without improving the existing gate. A separate stable repo is still premature; prefer protected branches, preview branches, or a separate experimental route first.

## Live/testing check

The available tool path could read repository files and patch GitHub, but could not execute npm locally or conclusively fetch the live Pages/Vercel shell from this run. Treat this as a code-gate repair cycle, not a proven live deployment cycle. The workflow still encodes the hosting/testing gate: `test:pages-preview` runs before artifact upload, then `test:remote-gate` runs after deployment using the deployed Pages URL.

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

Committed `1a2ba04e2d9ca3842ce2a1b94a30f937e3f69a50`: in `useWordlessSky`, the animation loop now skips canvas drawing while `document.hidden`, then resumes sizing cleanly on `visibilitychange`. This protects phone CPU/battery when the app is backgrounded without touching audio start/pulse behavior.

Committed `11b9747c54bd8d5086183e882af3a04f9c707db7`: updated `scripts/phone-contract-check.mjs` to protect the hidden-tab behavior, keep the phrase-contour canvas signature current, and assert the visibility listener cleanup.

## Next suggested action

Run `npm run test:composer-cycle`. If it fails, fix the exact failing check or build error before adding novelty. If it passes, inspect the latest GitHub Pages workflow result for `Pages Preview`. If build, deploy, and live verification pass, make exactly one tiny sensory improvement: let phrase contour subtly influence score-note spacing only. Do not couple it to audio in the same cycle. If the live Pages URL is unreachable but the build passes, branch to Cloudflare Pages only after recording the failing HTTP/status evidence.

## Later branch

After phone contract, Pages preview, and Pages remote all pass consistently, add a screenshot/browser proof route or artifact capture. Keep visible explainers and model demos away from the stable phone-first instrument by using a separate experimental route or branch before considering a separate stable repo.
