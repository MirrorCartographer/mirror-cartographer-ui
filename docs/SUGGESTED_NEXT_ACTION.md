# Suggested next action

## Current best next move

Make the deployment gate unambiguous before wiring `src/engine/fieldEncounter.js` into `src/components/App.jsx`.

The repo currently has two GitHub Pages workflows:

- `pages-preview.yml`: builds, deploys, then verifies the deployed Pages URL with the live remote gate.
- `pages.yml`: builds and deploys, but does not run the live remote gate after deployment.

Prefer the verified workflow. Remove, disable, or clearly supersede the deploy-only workflow if it is redundant.

## Why this is next

The site already has an explicit internal composer API:

`composition frame + phrase memory + inferred expectation + interaction signals -> possible futures -> selected field encounter`

But deployment confidence is the active constraint. Vercel can still serve a shell, but status checks are currently polluted by build-rate-limit failures. GitHub Pages is the stronger fallback only if the verified Pages workflow is the canonical path.

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
- `scripts/preview-url-check.mjs` now tries GitHub Pages before Vercel by default.
- Vercel is convenient for preview branches only when not rate-limited.
- GitHub Pages is good as a stable static fallback if the live remote gate is attached.
- Cloudflare Pages becomes the stronger host if the site gains edge/state endpoints, interaction capsules, or GitHub-write functions.
- Netlify is viable but does not currently solve a more specific problem than Cloudflare or GitHub Pages.

## Implementation target after gate clarity

On each intentional tap, compute a field encounter from:

- the tap composition frame
- phrase memory contour
- rough interaction features such as tap velocity, dwell time, or repetition

Then use the encounter internally to alter visual/audio pressure. Do not render the encounter as text. Do not couple it to audio in the same first wiring cycle.