# Self-Branching Composer

## Current branch decision

Testing/deployment confidence remains important, but the latest app surface regressed against the core product contract: it rendered explanatory network copy and replaced the weather/music instrument with a visible model demo. This cycle therefore branched from hosting verification back to contract recovery.

## Hosting assessment

Vercel remains the primary host because it still reports deploy status directly on commits and is the intended public atmospheric surface. GitHub Pages remains the best secondary surface for stable fallback/gallery preview, especially when Vercel has build-rate or preview reliability issues. Cloudflare Pages remains the next fallback candidate if GitHub Pages cannot be made reliable. Netlify remains viable but lower priority because it does not add enough unique confidence before Pages verification. A separate stable repository or branch is still premature unless main keeps accumulating experimental regressions that violate the phone-first contract.

## Live/testing check

The latest pre-cycle commit `4b2ee8392bd703b2e54088429097142546eee435` had a successful Vercel status, but commit status alone was not enough: repository inspection showed visible explanatory text, no `musicRef.current?.start?.` interaction path, and no wordless weather instrument surface. Public GitHub Pages URL fetch was not available through the current web tool path, and the available workflow-run lookup is not sufficient proof for push-triggered Pages runs. The actionable test remains the repo harness: `npm run test:phone-contract`, then `npm run test:pages-remote` once Pages is reachable.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight

## Change made in this cycle

Restored `src/components/App.jsx` to a wordless phone-first weather/music surface: canvas button, no visible explanatory copy, hidden story-seed weather marks, touch-driven weather state, tap-to-start `createSkyMusic`, low-count stars/motes/veins/rain, phrase-clock visual score, and the heart/weather field. This intentionally removed the visible neural-network panel rather than trying to preserve it, because visible instructional copy violates the current site contract.

## Next suggested action

Check Vercel status for commit `7f5b2c66f5461e8eaf533e8c0f04438fabd61edd`. If it succeeds, run `npm run test:phone-contract` from a checkout or CI-capable environment and then `npm run test:pages-remote`. If the phone contract fails, fix the exact contract failure before adding composition. If both pass, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.

## Later branch

If regressions like the visible neural-network demo recur, create a separate experimental branch or separate gallery route for visible explainers. Keep `main` as the stable wordless phone-first weather/music instrument.
