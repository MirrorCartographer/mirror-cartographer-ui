# Self-Rewriting Forge next action

Last assessed: 2026-07-09

## Current project need

Preserve the phone-first wordless weather/music surface while improving verification reliability. The current app already protects the core constraints: no autoplay, tap-to-start audio, low CPU budgets, no visible explanatory copy, and canvas-first interaction. The next useful work should not add visible language or heavy novelty until the remote preview gates are boringly reliable.

## Hosting/testing assessment

- Vercel remains useful as a public production-style host, but it has already needed guardrails for account/build-limit or dashboard pages. Keep it as one candidate, not the single source of truth.
- GitHub Pages is the safest low-risk fallback because the repo already has `build:pages`, `test:pages-preview`, and `test:pages-remote` scripts.
- Cloudflare Pages or Netlify could improve independent preview reliability later, but adding a third host now increases deployment surface area before the existing dual-candidate remote gate is proven stable.
- The safest branch strategy is to keep small gate/spec changes on the default branch, but put experimental visual/audio branches behind separate branches or PRs once branch tooling is available. Wordless UI regressions should not go directly to production.
- Available live-site view path in this runtime: the repo-side remote harness is currently stronger than public search/open because it checks candidate URLs directly, rejects Vercel limit/dashboard shells, verifies Vite root shell assets, probes bundled canvas/audio/React signals, and then runs the live Playwright gate.

## Action taken this cycle

Created this repo-resident note because the prior commit stream referenced composer/page gates, but no discoverable next-action note existed at the expected path. This gives the next cycle a stable handoff target without changing the visible site.

## Suggested next action

Make a tiny CPU/stability code patch: pause or heavily throttle the canvas animation loop while `document.hidden`, then add a static gate assertion for that visibility behavior. This directly supports phone-first battery stability without altering the wordless composition or tap-to-start audio boundary.

## Gate to run next

Prefer:

`npm run test:composer-cycle`

Then, when a live URL is reachable:

`npm run test:remote-gate`
