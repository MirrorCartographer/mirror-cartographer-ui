# Gate split reliability cycle — 2026-07-09

## Latest inspected handoff

The prior next action said to run `SITE_URL=<public-preview-url> npm run test:preview-url` or `Live URL Smoke`, then only add composition/audio-visual coupling after remote proof passes.

## Current assessment

- Latest commit inspected before this cycle: `da707bb5bf0b9372010b1c8b7d30c3fee7c4fb52` (`Record gate run 11 decision`).
- Combined status for that commit reports Vercel `failure` with target URL `https://vercel.com/mirror-cartographers-projects?upgradeToPro=build-rate-limit`.
- Public search for `mirror-cartographer-ui.vercel.app` did not return a usable public page result through the available web tool.
- No Cloudflare Pages, Netlify, or GitHub Pages public URL is available from the repo state.

## Decision

Do not add novelty yet. A concrete reliability regression appeared: `package.json` made `test:gate` run both local proof and remote URL proof. That makes the host-independent static artifact workflow depend on a reachable live URL, which is exactly what Vercel quota failures make unreliable.

## Implemented

- Commit `05f5a31e89466235ecbe5aafae4e4d1c63b3243f`: split scripts into:
  - `test:local-gate` = phone contract + production build + local Playwright smoke.
  - `test:remote-gate` = preview URL preflight + live Playwright smoke.
  - `test:gate` = local gate only, preserving backward compatibility for local proof.
- Commit `c5cae46cc45039cda89dee1f0e4c943555d533de`: changed `.github/workflows/build-artifact.yml` to call `npm run test:local-gate` explicitly.

## Hosting/testing assessment

- Vercel remains useful when quota is available, but it is not the reliable active proof lane while the latest checked status reports build-rate-limit.
- Cloudflare Pages remains the strongest next preview lane because this is a static Vite build with output directory `dist`.
- Netlify remains a valid fallback static host.
- GitHub Pages remains lower priority unless Vite base-path handling is configured.
- The current repo is safe for small reliability patches. Use a branch before larger composition/audio-visual experiments.

## Suggested next action

1. Inspect CI/status for `c5cae46cc45039cda89dee1f0e4c943555d533de`.
2. If `Static Preview Artifact` passes, download or inspect `mirror-cartographer-dist` as host-independent proof.
3. Then provide or create a public Vercel, Cloudflare Pages, or Netlify URL and run `SITE_URL=<public-preview-url> npm run test:remote-gate` or the `Live URL Smoke` workflow.
4. If remote proof passes, branch for the next smallest composition/audio-visual coupling change.
5. If remote proof fails, patch only reachability or runtime mismatch before adding novelty.

Preserve: no autoplay, tap-to-start audio, low CPU, no visible explanatory words, and phone-first stability.
