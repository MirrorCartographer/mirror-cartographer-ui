# Self-Branching Composer

## Current branch decision

The strongest move is now a narrow audio-visual coupling primitive, not another host patch. Vercel has already reported success for the restored wordless app commit, while the Actions lookup available here still does not prove push-triggered Pages runs. The repo contract is therefore stable enough for one small internal capability change, but not enough for visible feature expansion.

## Hosting assessment

Vercel remains the primary atmospheric surface when build quota is available because it reports deploy status directly on commits. It should not be the only confidence route while rate limits or pending builds can blur product failures with host failures. GitHub Pages remains the best secondary gallery/fallback surface because the repo already has a Pages workflow, `build:pages`, `test:pages-preview`, and `test:pages-remote`. Cloudflare Pages is still the next fallback only if GitHub Pages cannot reliably expose the built shell. Netlify is viable but lower priority. A separate stable repo is still premature; if visible explainers keep leaking into `main`, split by stable branch or gallery route first.

## Live/testing check

Vercel reported success for restored app commit `7f5b2c66f5461e8eaf533e8c0f04438fabd61edd`. The available commit workflow-run lookup returned no runs for that commit, but that lookup is known to miss push-triggered Pages runs, so the absence of workflow runs is not proof of Pages failure. After this cycle's code commit `fe008dd286150f092dabf337700877a1fda1ce47`, Vercel was still pending at check time. The actionable verification route remains: `npm run test:phone-contract`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight
- host failures must not be misread as product failures

## Change made in this cycle

Exposed shared composition shape from `src/engine/compositionFrame.js`: section, in-phrase index, phrase phase, and weather/section density now travel in the same frame object as beat, phase, phrase, pulse, rhythm, and state. This is deliberately internal and wordless. It gives the canvas a stable way to read the same phrase-density structure the audio engine already schedules from, without adding visible text or starting audio outside the tap path.

## Next suggested action

Run the contract gate after commit `fe008dd286150f092dabf337700877a1fda1ce47`. If `npm run test:phone-contract` fails, fix the exact failing assertion. If it passes, wire `clockSnapshot.density` and `clockSnapshot.phrasePhase` into `drawVisualScore` so score opacity, note lift, and spacing visibly breathe with the same phrase density the audio engine hears. Keep the surface wordless and do not add new instruments yet.

## Later branch

After phone contract and Pages remote both pass, add a Pages or Vercel screenshot/browser proof route. If visible explainers or model demos remain useful, route them away from the stable phone-first instrument with a separate experimental branch or gallery route before creating a separate stable repo.
