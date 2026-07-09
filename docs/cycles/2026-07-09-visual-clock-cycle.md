# Composition capability cycle — visual clock coupling

Status: active handoff after sharing the Composition Clock with the visual score.

## Read first

Current next-action source: `docs/cycles/2026-07-09-clock-wiring-cycle.md`.

The previous handoff said to run the gates first, then let the visual layer read the same clock snapshot used by audio if the path was clean. Because repository writes are working and the smallest source-level next step was isolated, this cycle implemented that visual coupling and expanded the static contract so the next run can verify it.

## Evaluation

The strongest need remains composition structure, but only in the narrow form of audio-visual coupling through the existing shared clock.

Priority order after this cycle:

1. Testing route — run the static gates and Playwright smoke gate.
2. Audio-visual coupling — now minimally implemented through the clock snapshot.
3. Playback repair — only if the smoke or manual phone test shows tap-to-start/audio failure.
4. Phrase memory/counterpoint/instrument design — still deferred.
5. Hosting/repository changes — still deferred.

## Host/repo verdict

Keep Vercel as primary.

GitHub writes are working. Vercel is not the bottleneck yet. Cloudflare Pages remains useful as a later parallel preview host if Vercel observability or deployment confidence becomes weak. Netlify and GitHub Pages do not currently offer enough benefit to justify switching. A separate stable repo would add overhead before the smoke gates are proven.

## View/test attempt

Direct public URL opening was attempted for the known Vercel URL, but the available web tool rejected it because the URL did not come from the current prompt or search results. Searching for the URL returned no results.

Concrete test route remains:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke` where Playwright browser execution is available
3. Manual iPhone tap test on the Vercel deployment

## Implementation result

Implemented smallest source change:

- `src/components/App.jsx` now stores the latest composition payload as `clockSnapshot` after a pointer tap.
- The canvas hook receives that snapshot.
- The visual score reads `clock.phase`, `clock.beat`, and `clock.phrase` for subtle score lift/drift.
- `scripts/phone-contract-check.mjs` now checks that the visual clock path exists.

Preserved constraints:

- no autoplay;
- tap-to-start remains pointer-driven;
- no visible explanatory words were added;
- no new instrument was added;
- phone-first canvas/orbit structure remains intact.

## Next suggested action

Run `node scripts/run-phone-gates.mjs`.

If it passes, run `npm run test:smoke` where browser execution is available.

If both pass, the next creative code cycle can add phrase memory as a tiny engine module, but it must be passive and clock-fed: no new visible text, no autoplay, and no new instrument. If any gate fails, fix only the failing gate before adding more composition behavior.
