# Self-Branching Composer

## Current branch decision

Reliability still leads, but novelty is not permanently blocked. The Pages deployment path is now unambiguous: the deploy-only `.github/workflows/pages.yml` workflow was removed, leaving `pages-preview.yml` as the canonical GitHub Pages path because it builds, deploys, and verifies the live URL.

Do not wire the new field encounter API into the app until the verified Pages workflow result is inspected. If that gate is green, allow exactly one tiny internal pressure patch with no visible text and no audio changes in the same cycle.

## Hosting assessment

Vercel remains suitable as the atmospheric primary host when build quota is available, but current status checks still classify Vercel as unreliable for gating because the latest visible status is a build-rate-limit failure, not a verified app-code failure. GitHub Pages is the strongest current fallback because `pages-preview.yml` builds, deploys, and then runs the live remote gate against the deployed Pages URL. Cloudflare Pages remains the next serious fallback if the project needs edge/state endpoints or if GitHub Pages cannot serve a stable built shell. Netlify remains lower priority because it would add another host without solving a more specific current problem. A separate stable repo is still premature; prefer verified workflow gates and preview branches first.

## Live/testing check

Available checks this cycle:

- Repository inspection confirmed `pages-preview.yml` includes post-deploy live verification.
- The older deploy-only Pages workflow was present and redundant, then removed.
- GitHub status for the recent handoff commit still showed Vercel failing with a build-rate-limit URL.
- No GitHub Actions workflow runs were returned for the checked handoff commit by the available commit-run tool.
- Public live fetch was not enough to prove the full phone interaction path; the canonical proof remains the live remote gate.

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
- `1ef814418ad1077560866accb142bc9606330bc2`: removed `.github/workflows/pages.yml`, the older Pages deploy workflow that did not run live verification.

## Next suggested action

Inspect the next `pages-preview.yml` workflow result. If build, deploy, and `test:remote-gate` pass, wire `src/engine/fieldEncounter.js` into `src/components/App.jsx` as internal visual pressure only. Do not render any explanatory text. Do not couple it to audio in the same first wiring cycle.

If `pages-preview.yml` fails, fix the exact failing step first. If the failure is deployment-host related rather than app-code related, record the HTTP/status evidence and consider Cloudflare Pages only after the GitHub Pages failure is concrete.

## Later branch

After phone contract, Pages preview, and Pages remote all pass consistently, add a screenshot/browser proof route or artifact capture. Keep visible explainers and model demos away from the stable phone-first instrument by using a separate experimental route or branch before considering a separate stable repo.