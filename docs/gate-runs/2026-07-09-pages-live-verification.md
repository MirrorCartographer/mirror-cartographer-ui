# Pages live verification gate

Decision: block novelty and strengthen hosting verification.

Latest inspected action: previous gate preferred GitHub Pages before Vercel and asked for Pages Preview + Smoke Test inspection. Recent commits also showed a new Pages deploy workflow and a recorded Pages workflow creation next action.

Assessment:
- Follow the branch away from Vercel-only reliability.
- Vercel remains suitable as a primary/simple production host only when build-rate-limit and interstitial issues are not active.
- GitHub Pages is now the best fallback/stable preview candidate because the project is a static Vite app and already has `build:pages` plus a Pages workflow.
- Cloudflare Pages or Netlify remain branch options only if GitHub Pages deployment fails or if future weather/API/runtime needs exceed static hosting.
- A separate stable repo is not needed yet; the existing rollback/stable marker pattern plus Pages fallback is enough.

Implemented in this run:
- Added a post-deploy `verify-live-pages` job to `.github/workflows/pages-preview.yml`.
- The job consumes the actual Pages deployment URL, installs Chromium, runs `npm run test:remote-gate`, and uploads Playwright failure artifacts.

Reliability impact:
- Pages build success alone is no longer treated as enough.
- The deployed public URL must pass the same remote/live gate used for phone-first playback behavior.
- This improves testability without changing product UI or adding novelty.

Next suggested action:
Inspect the Pages Preview workflow after commit `1fe8561`. If `verify-live-pages` is green, create a stable release marker. If it fails, fix only the failing deployed-URL gate step before touching Composition Clock or any visible feature.
