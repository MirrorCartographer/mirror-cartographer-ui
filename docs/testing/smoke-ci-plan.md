# Smoke CI plan

Status: workflow creation was attempted during the build cycle, but repository workflow writes were not available through the current tool path.

## Intended check

Run the phone-first smoke harness on every main-branch push and pull request:

- install dependencies with `npm install`;
- install Playwright Chromium;
- build with `npm run build`;
- run `npm run test:smoke`.

## Current committed improvement

`playwright.config.js` now uses a CI-friendly mobile Chromium profile instead of a WebKit-shaped project. That keeps the test focused on the essential contract: phone viewport, touch input, tap survival, canvas render, and no visible explanatory text.

## Manual command

Run this locally or in any CI runner:

`npm install && npx playwright install --with-deps chromium && npm run build && npm run test:smoke`

## Next preferred repository change

Add a GitHub Actions workflow at `.github/workflows/smoke.yml` when workflow-file writes are available.

## Hosting note

Vercel should remain the primary host until the smoke test is actually running. Cloudflare Pages is still the best parallel preview candidate if Vercel previews become unreliable, but migration before test visibility would mostly move the same risk to another host.
