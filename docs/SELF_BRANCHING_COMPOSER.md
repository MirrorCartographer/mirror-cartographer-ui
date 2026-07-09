# Self-Branching Composer

## Current branch decision

Followed the previous coupling path rather than branching into a new host or new instrument. The repo already exposed composition density and phrase phase; the missing high-leverage move was to let the wordless visual score breathe from those same values. This is still a conservative internal composition change, not a visible explainer or a larger feature surface.

## Hosting assessment

Vercel remains the primary atmospheric surface when build quota is available because it reports deploy status directly on commits. It should not be the only confidence route while rate limits can blur product failures with host failures. GitHub Pages remains the best secondary/fallback surface because the repo already has a Pages workflow, `build:pages`, `test:pages-preview`, and `test:pages-remote`. Cloudflare Pages is still the next fallback only if GitHub Pages cannot reliably expose the built shell. Netlify is viable but lower priority. A separate stable repo is still premature; if visible explainers keep leaking into `main`, split by stable branch or gallery route first.

## Live/testing check

The current pre-cycle main commit `46cde18728a487ecd3e73c7e14d9ee449efc9a85` reported Vercel failure with the build-rate-limit upgrade URL, which is a host quota signal rather than a product regression signal. GitHub workflow-run lookup returned no runs for that commit, and that lookup still does not prove whether push-triggered Pages deployment is disabled or merely invisible to this connector. Public URL fetch from this environment could not safely open either the Vercel URL or the GitHub Pages URL, so the reliable verification route remains repo-side gates: `npm run test:phone-contract`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- low CPU before new visual density
- host failures must not be misread as product failures

## Change made in this cycle

Committed `aa5b12f12a7d523c69424dc619270588b0785351`: `drawVisualScore` now reads `clockSnapshot.density` and `clockSnapshot.phrasePhase`. The score staff, note opacity, note lift, spacing, and shadow breathe with the same phrase-density frame that the audio engine receives after tap. No visible explanatory words were added, no autoplay path was changed, and no new instruments were introduced.

## Next suggested action

Run `npm run test:phone-contract` after commit `aa5b12f12a7d523c69424dc619270588b0785351`. If it fails, fix the exact assertion. If it passes, add a tiny contract or unit check that protects the phrase-density coupling by searching the built bundle/source for `phrasePhase` and `density` usage in the visual score path. Only after that should the next cycle adjust composition behavior again.

## Later branch

After phone contract and Pages remote both pass, add a Pages or Vercel screenshot/browser proof route. If visible explainers or model demos remain useful, route them away from the stable phone-first instrument with a separate experimental branch or gallery route before creating a separate stable repo.
