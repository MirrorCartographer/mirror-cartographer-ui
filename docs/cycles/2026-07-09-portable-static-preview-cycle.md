# Portable static preview cycle — 2026-07-09

## Latest inspected next action

The latest cleanup note said to run `SITE_URL=<public-preview-url> npm run test:preview-url`, then run `npm run test:live` or the `Live URL Smoke` workflow against a public Vercel, Cloudflare Pages, or Netlify URL. It also said not to add novelty until hosting/reachability proof exists.

## Assessment

- Latest inspected commit: `fa168a74483eac10558e90de0c3fa923715e57c9` (`Record gate 12 decision`).
- Current checked Vercel status: failure, target URL points to Vercel build-rate-limit upgrade path.
- Vercel remains valuable when quota is available, but it is not the reliable active proof lane for this cycle.
- Cloudflare Pages remains the best independent preview path for the Vite static build using `npm run build` and output `dist`.
- Netlify remains a valid fallback static preview path.
- GitHub Pages became more feasible after this cycle because the Vite asset base is now relative, but it remains lower priority than Cloudflare Pages unless GitHub Pages deployment is explicitly configured.
- The current repository remains safe for small reliability patches. Use the existing stable branch or a new feature branch before larger creative/audio-visual experiments.
- No public live URL was available from the inspected tools, so browser/screenshot proof still requires a public deployed URL or a downloaded artifact served locally.

## Decision

Revise the previous next action. Since no public URL is available and Vercel is build-rate-limited again, improve the host-independent preview artifact path instead of adding visual or musical novelty.

## Implemented

- Set `base: './'` in `vite.config.js` so built assets resolve relative to `index.html`.
- Added a phone-contract assertion that guards the relative asset base.

## Why this is high leverage

The project already uploads `dist` as a static artifact, but absolute asset paths make artifact viewing and subpath hosting more fragile. A relative asset base makes the same build more portable across:

- downloaded `dist` artifact served locally,
- Cloudflare Pages,
- Netlify,
- GitHub Pages project paths,
- future static preview lanes.

This preserves the required surface contract: no autoplay, tap-to-start audio, low CPU, no visible explanatory words, and phone-first stability.

## Suggested next action

1. Inspect CI for commit `e51083d11b17305bd7c4cf5b1d1b4745367bfc7b`.
2. If local gate passes, download or serve the `mirror-cartographer-dist` artifact and run a browser smoke check against it.
3. If a public URL becomes available, run `SITE_URL=<public-preview-url> npm run test:remote-gate`.
4. If no public URL is available, configure Cloudflare Pages first; use GitHub Pages only if Cloudflare setup stalls.
5. Only after portable artifact proof plus live URL proof pass should the next cycle add the next small audio-visual coupling change.
