# Self-Rewriting Forge run: phone-first weather/music site

## Assessment

The private Vite/React repo remains the correct source for the phone-first weather/music instrument.

Current contract to preserve:

- no autoplay
- tap-to-start audio
- low CPU / mobile-safe animation budget
- no visible explanatory words
- phone-first stability

Recent repo state already points toward reliability rather than novelty: smoke tests, Cloudflare Pages config, SPA fallback, and run notes are present in the commit history. This run followed that path.

## Hosting decision

Primary host: Vercel remains the baseline for the private prototype because it is already attached to the existing app path and is suited to quick Vite previews.

Second host candidate: Cloudflare Pages remains useful as a parallel preview path for this same private app because `wrangler.jsonc` targets `./dist` and `public/_redirects` provides SPA fallback.

Public/stable mirror: the separate public `MirrorCartographer/MirrorCartographer` repo is safer for a public Cloudflare doorway. It should not replace the private phone-weather/music instrument unless intentionally copied or rebuilt there.

Netlify: viable for the Vite static app, but does not currently improve safety over Vercel + Cloudflare unless Vercel deploys remain unreliable.

GitHub Pages: viable only as a static fallback, but lower priority because preview ergonomics and SPA routing are weaker for this workflow.

## Live-site test result

The available tools could not confirm the deployed Vercel URL in this run:

- web open rejected the URL because it was not present in search results
- search returned no indexed result for the Vercel host
- container `curl` failed DNS resolution for `mirror-cartographer-ui.vercel.app`

Treat this as an environment/tool limitation, not proof that Vercel is down.

## Implemented change

Added `tests/live-hosting.spec.js`, an optional Playwright live-preview smoke test gated by `LIVE_SITE_URL`.

Use it after any Vercel, Cloudflare Pages, Netlify, or GitHub Pages preview exists:

`LIVE_SITE_URL=https://example-preview-url npm exec playwright test tests/live-hosting.spec.js --reporter=line`

The test checks:

1. phone viewport loads
2. `button.sky` appears
3. `canvas` appears
4. visible body text remains empty
5. first tap does not crash the app
6. no page or console errors are emitted during the smoke window

## Suggested next action

Do not add new visual complexity until one deployed URL is externally confirmed with the live-hosting smoke test.

Next cycle should:

1. Try to obtain a deploy URL from Vercel or Cloudflare Pages logs/dashboard if accessible.
2. Run or simulate `LIVE_SITE_URL=<deploy-url> npm exec playwright test tests/live-hosting.spec.js --reporter=line`.
3. If live smoke passes, add the next composition layer: touch-position-to-audio modulation that changes sound only after user tap and keeps visible surface wordless.
4. If live smoke fails, fix hosting/build/runtime before adding novelty.
