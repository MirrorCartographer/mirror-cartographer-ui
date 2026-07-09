# Self-Branching Composer

## Current branch decision

Testing/deployment confidence remains the strongest move. The public fallback route cannot be considered real until there is a direct remote gate against the GitHub Pages URL, so this cycle prioritized making that check explicit and repeatable over adding new atmosphere, instruments, or phrase behavior.

## Hosting assessment

Vercel should remain the primary atmospheric host when builds are available. It is still the best public-facing surface for the living phone-first weather/music piece.

GitHub Pages is the best current secondary surface: not a replacement for the atmosphere, but the stable gallery/fallback route. The repo is private, so this route may still require manual repository settings: Actions must be enabled and Pages source must be GitHub Actions. Cloudflare Pages remains the next fallback candidate if GitHub Pages cannot be made reliable. Netlify is viable but does not add enough confidence to justify a third host before GitHub Pages is verified. A separate stable repo is premature unless the current private repo keeps blocking public previews.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight

## Change made in this cycle

The previous next action asked for Pages workflow inspection and then a remote gate against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`. The repository connector could confirm the workflow file and package scripts, and it could confirm that Vercel reported success for the Pages-workflow commit, but the available workflow-run lookup only returns PR-triggered runs. An empty workflow-run result was therefore not treated as proof that the push workflow failed.

A dedicated `test:pages-remote` script was added so the next run has one unambiguous command for the GitHub Pages surface. It pins `SITE_URL` to the Pages URL and reuses the existing remote gate, which already checks the app shell, bundled script assets, canvas/audio/React signals, live wiring, and live Playwright smoke path.

## Next suggested action

Run `npm run test:pages-remote` from a working checkout or CI environment. If it passes, mark GitHub Pages as a verified gallery/fallback surface and return to audio-visual coupling. If it fails with HTTP 404 or missing app shell, verify repository settings: Actions must be enabled and Pages source must be GitHub Actions. If it fails inside the live smoke path, inspect the Playwright failure before changing composition code.

## Later branch

Once public route confidence is stable, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.
