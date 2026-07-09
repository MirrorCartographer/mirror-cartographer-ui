# Next action after smoke harness

Status: active next-action note.

## What changed

A phone-first Playwright smoke harness exists:

- `tests/smoke.spec.js`
- `playwright.config.js`
- `npm run test:smoke`

The harness checks mobile render, sky button/canvas presence, first tap survival, console/page errors, and the wordless visible surface.

## Current cycle update

`playwright.config.js` was revised to use a CI-friendly mobile Chromium profile. This keeps the test focused on the contract that matters most for the public site: phone viewport, touch input, canvas render, tap-to-start survival, and no visible explanatory text.

A GitHub Actions workflow write was attempted but blocked by the current tool path, so the CI plan was saved at `docs/testing/smoke-ci-plan.md`.

## Self-directed automation verdict

The setup is better, but still incomplete until the smoke test is actually executed by a local runner, GitHub Actions, Vercel build hook, or another CI surface.

Before: the loops could keep adding music/visual features without a repeatable check.

Now: the loops have a testable gate and a CI-ready config, but no confirmed run result yet.

## Hosting verdict

Keep Vercel for now. The next limitation is not hosting; it is whether automated runs can verify behavior before committing more features.

Do not migrate until:

1. `npm run test:smoke` passes locally or in CI.
2. The site is manually confirmed on iPhone after a tap.
3. A stable branch or rollback rule exists.

Cloudflare Pages remains the best parallel preview candidate if Vercel previews become unreliable, but migration before test visibility would mostly move the same risk to another host. Netlify is acceptable but not stronger enough to justify churn. GitHub Pages remains a weak primary fit for this experimental app.

## Suggested next action

First choice: add `.github/workflows/smoke.yml` when workflow-file writes are available, then run the smoke harness on push and pull request.

Second choice: manually run:

`npm install && npx playwright install --with-deps chromium && npm run build && npm run test:smoke`

If the smoke test fails, fix only the smoke failure. If it passes, the next build step should be a Composition Clock primitive so audio, visuals, touch, and weather share one event stream.

## Rule for future automations

Every future feature cycle should include one of:

- smoke test run result;
- proof that test execution was unavailable;
- a smaller static check;
- or a next-action note explaining the blocker.

No new creative layer should be added without checking mobile stability or explaining why the check could not be performed.
