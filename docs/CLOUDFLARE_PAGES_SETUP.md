# Cloudflare Pages setup

Status: parallel preview target, not a replacement for Vercel yet.

## Why this exists

The phone-first weather/music site is a Vite React app. Vercel remains the primary host until Cloudflare proves equal or better preview reliability. Cloudflare Pages should be added as a parallel deployment path so the site has a second public preview surface when Vercel deploys, DNS, or rate limits are unreliable.

## Cloudflare dashboard setup

Use Cloudflare Pages with Git integration.

Repository: `MirrorCartographer/mirror-cartographer-ui`
Production branch: `main`
Build command: `npm run build`
Build output directory: `dist`
Root directory: `/`
Node version: use Cloudflare default unless build logs require pinning.

Cloudflare's Vite Pages guide uses `npm run build` and `dist` for Vite output. The repo also includes `wrangler.jsonc` with `pages_build_output_dir` set to `./dist` so the output directory is versioned.

## Safety rules

- Keep Vercel as primary until Cloudflare has one successful production deploy and one successful commit-triggered redeploy.
- Do not connect a custom domain to Cloudflare until the pages.dev preview passes smoke checks.
- Do not add Workers Functions, KV, D1, analytics, or edge logic yet.
- Preserve no autoplay, tap-to-start audio, low CPU, no visible explanatory words, and phone-first stability.

## Current live-site check

2026-07-08: container DNS lookup for `mirror-cartographer-ui.vercel.app` failed with `Could not resolve host`. Web search did not return an indexed result for the Vercel URL. Treat this as an inconclusive tool/network failure, not proof the deployed site is down.

## Smoke gate after Cloudflare deploy

When the `*.pages.dev` URL exists, run:

1. Open the pages.dev URL on a phone-sized viewport.
2. Confirm blank/wordless visual surface loads.
3. Confirm no autoplay audio.
4. Tap once and confirm audio starts only after gesture.
5. Confirm no visible explanatory text appears.
6. Run `npm run test:smoke` locally or in CI with the Cloudflare URL if the smoke test supports a base URL.

## Suggested next action

Create the Cloudflare Pages project from the dashboard using Git integration, then paste the generated `*.pages.dev` URL into the next build cycle. Next code change should be only a smoke-test base URL hook if needed.
