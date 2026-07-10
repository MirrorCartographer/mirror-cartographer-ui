# Suggested next action

## Current best next move

Inspect the next `pages-preview.yml` workflow result before wiring `src/engine/fieldEncounter.js` into `src/components/App.jsx`.

The repo no longer has two competing GitHub Pages workflows. The deploy-only `.github/workflows/pages.yml` workflow was removed. `pages-preview.yml` is now the canonical static fallback path because it:

- runs the Pages preview gate,
- deploys to GitHub Pages,
- runs `npm run test:remote-gate` against the deployed URL.

## Why this is next

The site already has an explicit internal composer API:

`composition frame + phrase memory + inferred expectation + interaction signals -> possible futures -> selected field encounter`

But deployment confidence is the active constraint. Vercel can still serve a shell, but status checks are currently polluted by build-rate-limit failures. GitHub Pages is the stronger fallback now that the verified workflow is the only Pages deployment path.

## Preserve

- no autoplay
- tap-to-start only
- no visible explanatory copy
- phone-first canvas stability
- low CPU scheduling
- no audio changes while the deploy gate is ambiguous
- weather remains a bias, not the whole decision
- expectation remains inferred and uncertain, not a claim about the person

## Test route

Run or inspect:

- `npm run test:field-encounter`
- `npm run test:phone-contract`
- `npm run test:composer-cycle`
- `pages-preview.yml` deploy + `test:remote-gate`

Host confidence notes:

- Current repo is Vite.
- `scripts/preview-url-check.mjs` tries GitHub Pages before Vercel by default.
- Vercel is convenient for preview branches only when not rate-limited.
- GitHub Pages is the stable static fallback if `pages-preview.yml` passes.
- Cloudflare Pages becomes the stronger host if the site gains edge/state endpoints, interaction capsules, or GitHub-write functions.
- Netlify is viable but does not currently solve a more specific problem than Cloudflare or GitHub Pages.

## Implementation target after gate clarity

On each intentional tap, compute a field encounter from:

- the tap composition frame
- phrase memory contour
- rough interaction features such as tap velocity, dwell time, or repetition

Then use the encounter internally to alter visual pressure only. Do not render the encounter as text. Do not couple it to audio in the same first wiring cycle.