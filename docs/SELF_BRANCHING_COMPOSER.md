# Self-Branching Composer

## Current branch decision

Followed the previous handoff through the stability path, then branched only one step into composition behavior after source inspection. The app already had a phrase-memory primitive in `src/engine/phraseMemory.js`, but the phone-first canvas was not consuming it. The strongest move was to make prior tap/composition contour return as a hidden score mark, rather than adding a new host, explainer route, visible copy, or heavier visual system.

## Hosting assessment

Vercel remains the primary atmospheric deploy target when quota is available; previous Vercel failures still look like build-rate-limit signals rather than app regressions. GitHub Pages remains the best fallback because this repo has a Pages base build plus `test:pages-preview` and `test:pages-remote`. Cloudflare Pages is still the next fallback if GitHub Pages cannot expose a stable built shell. Netlify remains lower priority. A separate stable repo is premature; if visible explainers or model demos leak into `main` again, split first by protected branch or separate experimental route.

## Live/testing check

Workflow lookup for the latest package-script commit returned no runs, matching prior connector limitations for push-triggered Pages/Actions visibility. Do not treat absent workflow results as proof of deploy failure. Reliable local/CI gate order is now: `npm run test:phone-contract`, `npm run test:phrase-memory-score`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/` when Pages is known enabled.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- low CPU before new visual density
- host failures must not be misread as product failures
- visual composition changes must be contract-protected before more novelty

## Change made in this cycle

Committed `30f30479d2c08d48d181751ac8722ca394a13cfd`: `src/components/App.jsx` now creates phrase memory without starting audio, remembers tap composition frames, converts the remembered contour into one hidden canvas mark, and feeds that mark into the existing active score/memory field. This makes return-memory visible as recurrence in the wordless score without adding text, autoplay, or extra high-density particles.

Committed `9bee0833fe100ef8f989563a2203754975878a8d`: added `scripts/phrase-memory-score-check.mjs` as a focused static guard because the full phone-contract patch was blocked by the write filter.

Committed `2ea5417d0df50266d8b53025a8dcc580ca105b21`: wired `test:phrase-memory-score` into `test:local-gate` and `test:pages-preview`.

## Next suggested action

Run `npm run test:local-gate`. If it fails, fix the exact failing check or build error before adding novelty. If it passes, run `npm run test:pages-preview`; if that passes, use one small audio-visual coupling move: let phrase contour subtly influence either audio motif return or score-note spacing, but not both in the same cycle.

## Later branch

After phone contract, Pages preview, and Pages remote all pass, add a Pages or Vercel screenshot/browser proof route. If visible explainers or model demos remain useful, route them away from the stable phone-first instrument with a separate experimental branch or gallery route before creating a separate stable repo.
