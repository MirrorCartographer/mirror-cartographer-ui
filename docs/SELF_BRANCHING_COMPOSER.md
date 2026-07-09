# Self-Branching Composer

## Current branch decision

Testing/deployment confidence remained the strongest move. The newest hosting signal showed Vercel failing with a build-rate-limit target, while no GitHub Actions workflow run was visible for the checked commit. That makes preview reliability the active constraint, not visual novelty.

## Hosting assessment

Vercel should remain the primary host when builds are available, because it is already the known public atmosphere and the app is a Vite/React surface. However, Vercel is not sufficient as the only preview route while build-rate-limit failures occur.

GitHub Pages is now the best safety fallback because the repo already has a Pages workflow and static build path. Cloudflare Pages remains the strongest later fallback if GitHub Pages cannot be enabled or if Pages deploys are too slow/unreliable. Netlify is viable but adds another deployment surface without solving the immediate GitHub-native verification gap. A separate repository or branch is not necessary yet; the safer path is a deterministic fallback gate on `main` before introducing branch drift.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight

## Change made in this cycle

The remote preview gate now treats both Vercel and GitHub Pages as default candidates. The public URL probe no longer accepts any generic Vite shell: it fetches script bundles and requires signals for the phone sky app, including canvas drawing, React/runtime shell, and the tap/audio interaction boundary.

## Next suggested action

Verify whether the GitHub Pages workflow actually runs after the latest commit. If it still does not run, inspect repository Pages settings manually: Settings -> Pages -> Source should use GitHub Actions. If Actions are disabled, enable Actions for the repository. Once a Pages deployment exists, run the remote gate against `https://mirrorcartographer.github.io/mirror-cartographer-ui/` and only then return to new composition work.

## Later branch

Once public route confidence is stable, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.
