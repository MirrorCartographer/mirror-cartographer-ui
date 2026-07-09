# Preview block detection cycle — 2026-07-09

## Read first

The latest handoff said to run `node scripts/run-phone-gates.mjs`, then `npm run test:smoke`, then verify Vercel or move to another public preview lane before wiring `createPhraseMemory` into `App.jsx`.

## Current signal

The latest inspected commit before this cycle was `ed2ae54b4dbecbe3ee67144d871f895bbbd9898e` (`Record live wiring proof cycle`). Its combined status still reported Vercel failure with target URL `https://vercel.com/mirror-cartographers-projects?upgradeToPro=build-rate-limit`.

That means the strongest need is not playback repair, new counterpoint, weather mapping, instrument design, or phrase-memory wiring. The strongest need remains a reliable testing/deployment route.

## Decision

Branch away from feature work. The next feature path is blocked until the public preview route can distinguish a real app shell from a Vercel account/build-limit page.

Keep Vercel as the canonical production target only if it becomes reachable again, but do not rely on it as the only preview lane. Cloudflare Pages is the best parallel lane for confidence because this is a Vite static app with `npm run build` and `dist`. Netlify remains an acceptable fallback. GitHub Pages remains lower priority unless repository-subpath routing is explicitly validated.

A separate stable repo is not required yet. The current private repo is helping iteration for small proof commits; hosting, not repository structure, is the weak link.

## Implementation

Commit `7eeb0f54d4fc5917387e175237cc07454b7a30b7` updated `scripts/preview-url-check.mjs` so the remote gate fails if:

- a checked URL redirects to `vercel.com`;
- the final URL includes `upgradeToPro`;
- returned HTML contains Vercel build-limit/dashboard markers such as `upgradeToPro`, `build-rate-limit`, or `mirror-cartographers-projects`.

This preserves the existing expectations that the preview must return HTML, include the Vite React root, and expose bundled app assets.

## What remains unverified

I did not run local Node gates or Playwright from this connector environment. I did verify through GitHub status that the available Vercel lane is still failing due to build-rate-limit.

## Next suggested action

Run:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`
3. `npm run test:remote-gate`

Expected result right now: the remote gate should fail clearly if the default Vercel URL still resolves to the build-limit/account page.

If remote gate fails for Vercel, create a Cloudflare Pages project from the same repo with:

- build command: `npm run build`
- output directory: `dist`

Then run:

`SITE_URL=<cloudflare-pages-url> npm run test:remote-gate`

Only after static gate, browser smoke, and one public remote gate pass should the next cycle wire `createPhraseMemory` into `App.jsx` as low-frequency internal modulation. Preserve no autoplay, tap-to-start, efficient scheduling, no visible explanatory words, and phone-first stability.
