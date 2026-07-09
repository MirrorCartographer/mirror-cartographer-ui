# Self-Branching Composer

## Current branch decision

Testing/deployment confidence remains the strongest move. The app already has candidate fallback logic for Vercel and GitHub Pages, but the public fallback route still needs proof that GitHub Pages is actually configured and deploying from Actions.

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

The GitHub Pages workflow was hardened with `actions/configure-pages@v5` before the static build/upload step, and the deploy job now declares its own minimal Pages/OIDC permissions. This makes the workflow more explicit and reduces the chance that a Pages deployment fails because repository Pages metadata or job permissions were implicit.

## Next suggested action

Inspect the workflow run for commit `97119f184098fc125b850167b68ee2037b02692a`. If it completed, run the remote gate against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`. If it did not run, the next action is manual repository configuration: Settings -> Actions should allow workflows, and Settings -> Pages -> Source should be GitHub Actions. If the workflow ran but failed, inspect the failed job logs before changing app code.

## Later branch

Once public route confidence is stable, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.
