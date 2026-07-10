# Self-Branching Composer

## Current branch decision

Reliability still leads, but novelty is not permanently blocked. The right rule is: allow one tiny novelty patch only after the active phone/static/live gates are coherent. This cycle did not wire the new field encounter API into the app because the preview and hosting probes still had a mismatch: the remote gate preferred GitHub Pages first, while the standalone preview URL check preferred Vercel first despite current Vercel build-rate-limit noise.

## Hosting assessment

Vercel remains suitable as the atmospheric primary host when build quota is available, but current status checks still classify Vercel as unreliable for gating because the latest visible status is a build-rate-limit failure, not a verified app-code failure. GitHub Pages is the strongest current fallback because `pages-preview.yml` builds, deploys, and then runs the live remote gate against the deployed Pages URL. Cloudflare Pages remains the next serious fallback if the project needs edge/state endpoints or if GitHub Pages cannot serve a stable built shell. Netlify remains lower priority because it would add another host without solving a more specific current problem. A separate stable repo is still premature; prefer workflow cleanup and preview branches first.

## Live/testing check

Available checks this cycle:

- Public fetch reached the Vercel root as a live HTML shell, but GitHub status still reports Vercel build-rate-limit failure.
- Public search/fetch did not conclusively prove the GitHub Pages shell from this environment.
- Repository inspection showed two Pages workflows: `pages-preview.yml` includes post-deploy live verification; `pages.yml` deploys without the live remote gate.
- The standalone preview checker now defaults to GitHub Pages before Vercel, matching `remote-gate.mjs`.

Reliable gate order is now:

1. `npm run test:composer-cycle`
2. `pages-preview.yml` build and deploy
3. `npm run test:remote-gate` using the deployed Pages URL
4. Vercel status only as secondary evidence while quota failures persist

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

## Recent changes

- `1a2ba04e2d9ca3842ce2a1b94a30f937e3f69a50`: hidden-tab rendering throttling in `useWordlessSky`.
- `11b9747c54bd8d5086183e882af3a04f9c707db7`: phone contract protection for hidden-tab behavior.
- `daf5eb6fa833c74cf5e1df132f4381b4c5081e51`: `scripts/preview-url-check.mjs` now tries GitHub Pages before Vercel by default, reducing false confidence loss from Vercel quota/build-limit pages.

## Next suggested action

Inspect the Pages workflows and remove or disable the older deploy-only Pages workflow if it is redundant with `pages-preview.yml`. The stable deployment path should be the one that builds, deploys, and verifies the live URL. Do not wire `fieldEncounter.js` into `App.jsx` until the Pages workflow situation is unambiguous.

If workflow cleanup is unsafe or blocked, run/inspect `npm run test:composer-cycle` and the latest `pages-preview.yml` result. If those pass, allow exactly one tiny novelty patch: wire `fieldEncounter.js` into the tap path as internal pressure only, with no visible text and no audio changes in the same cycle.

## Later branch

After phone contract, Pages preview, and Pages remote all pass consistently, add a screenshot/browser proof route or artifact capture. Keep visible explainers and model demos away from the stable phone-first instrument by using a separate experimental route or branch before considering a separate stable repo.