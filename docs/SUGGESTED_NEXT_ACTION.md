# Suggested next action

## Current best next move

Wire `src/engine/fieldEncounter.js` into the tap path in `src/components/App.jsx` without adding visible explanatory text.

The site now has an explicit internal composer API:

`composition frame + phrase memory + inferred expectation + interaction signals -> possible futures -> selected field encounter`

This should become the bridge between gesture, weather, audio, and canvas pressure.

## Why this is next

The playback/tap boundary already has contract checks. The weaker layer was not audio repair; it was the missing object that names what the site is choosing between. The new pure selector gives the app a way to move from state transitions to possibility transitions.

## Preserve

- no autoplay
- tap-to-start only
- no visible explanatory copy
- phone-first canvas stability
- low CPU scheduling
- weather remains a bias, not the whole decision
- expectation remains inferred and uncertain, not a claim about the person

## Test route

Run:

- `npm run test:field-encounter`
- `npm run test:phone-contract`
- `npm run test:composer-cycle`

Host confidence notes:

- Current repo is Vite. Vercel and GitHub Pages are already represented in remote tests.
- Vercel is convenient for preview branches when not rate-limited.
- GitHub Pages is good as a stable static fallback.
- Cloudflare Pages becomes the stronger host if the site gains edge/state endpoints, interaction capsules, or GitHub-write functions.
- Netlify is viable but does not currently solve a more specific problem than Cloudflare or GitHub Pages.

## Implementation target

On each intentional tap, compute a field encounter from:

- the tap composition frame
- phrase memory contour
- rough interaction features such as tap velocity, dwell time, or repetition

Then use the encounter internally to alter visual/audio pressure. Do not render the encounter as text.
