# Self-Branching Composer

## Current branch decision

Testing/deployment confidence remains the strongest move. The public fallback route cannot be considered real until GitHub Actions visibly builds and deploys the Pages artifact, so this cycle prioritized the missing workflow path over new atmosphere or music changes.

## Hosting assessment

Vercel should remain the primary atmospheric host when builds are available. It is still the best public-facing surface for the living phone-first weather/music piece.

GitHub Pages is the best current secondary surface: not a replacement for the atmosphere, but the stable gallery/fallback route. The repo is private, so this route may still require manual repository settings: Actions must be enabled and Pages source must be GitHub Actions. If Pages cannot be enabled or is unreliable, Cloudflare Pages becomes the next fallback candidate because it can deploy a static Vite build with low friction. Netlify is still viable, but it does not add enough confidence to justify a third host before GitHub Pages is verified. A separate stable repo is premature unless the current private repo keeps blocking public previews.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight

## Change made in this cycle

A missing `.github/workflows/pages.yml` workflow was added. It builds on pushes to `main` and manual dispatch, runs the phone/static gate, builds the Vite app with the Pages base path, configures Pages, uploads `dist`, and deploys through `actions/deploy-pages` with minimal required permissions.

The previous note said the workflow had been hardened, but file inspection found no Pages workflow at the expected path. Creating the workflow was therefore higher leverage than modifying app composition.

## Next suggested action

Inspect the workflow run for commit `f02bf26739167a5743bf71903cf70d7800b4955d`. If it completed, run the remote gate against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`. If no run appears, manually verify repository settings: Actions must allow workflows, and Pages source must be GitHub Actions. If the workflow ran but failed, inspect the failed job logs before changing app code.

## Later branch

Once public route confidence is stable, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.
