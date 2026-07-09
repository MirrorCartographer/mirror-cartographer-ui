# Hosting test cycle note — 2026-07-08

## Assessment

The phone-first weather/music app remains best treated as a private Vercel baseline plus a second Cloudflare Pages preview lane.

Vercel is still a good primary host for this Vite/React instrument because it is already connected to the private repo and matches the current deployment flow. However, prior run output reported a Vercel build failure routed to a build-rate-limit upgrade page, so Vercel should not be the only preview path.

Cloudflare Pages is the strongest second lane for preview reliability because the app is static, phone-first, and does not require server runtime features. Netlify is also viable for static preview, but does not add a stronger advantage than Cloudflare right now. GitHub Pages can host the built static assets, but it is less useful for the immediate goal of testing deploy previews and production-like hosting behavior.

## Live testing constraint

The available web tool could not directly open the Vercel URL unless it appeared in prior search results, and search returned no indexed result. Treat that as a tool-access limitation, not proof that the site is down.

## Change made

Added a dedicated live Playwright config and live smoke test:

- `playwright.live.config.js`
- `tests/live.spec.js`

Run manually or in CI with:

`SITE_URL=https://deployed-site.example npm exec playwright test tests/live.spec.js --reporter=line --config=playwright.live.config.js`

The test preserves the current contract:

- phone-sized viewport
- touch-capable profile
- visible canvas/button surface
- no visible body text
- tap survives without page errors
- no autoplay assumptions; audio path remains user-gesture based

## Suggested next action

Wire this live test into a manually triggered GitHub Actions workflow that accepts a `site_url` input, then run it against the Vercel URL and the first Cloudflare Pages URL. Do not add more creative audio-visual behavior until at least one live host passes the phone contract from CI or another browser-capable environment.
