# Next action after smoke harness

Status: active next-action note.

## What changed

A phone-first Playwright smoke harness exists:

- `tests/smoke.spec.js`
- `playwright.config.js`
- `npm run test:smoke`

The harness checks mobile render, sky button/canvas presence, first tap survival, console/page errors, and the wordless visible surface.

## Current cycle update

A static phone-contract checker exists at `scripts/phone-contract-check.mjs`.

It verifies the core invariants without needing a browser runner:

- tap-to-start remains pointer based;
- music start remains inside the interaction path;
- the visible surface remains a canvas inside the sky button;
- no visible instruction copy appears in the app body;
- the smoke test and Playwright config still target a touch-capable phone-shaped viewport.

The package scripts now include three gate paths:

- `npm run test:phone-contract` for the fast static invariant check;
- `npm run test:smoke` for local Playwright preview smoke;
- `npm run test:gate` for contract check + build + smoke in one command.

The GitHub Actions smoke workflow is present and uses `npm install`, not `npm ci`, so the earlier missing-lockfile blocker is no longer the known primary blocker.

## Self-directed automation verdict

The system should still block novelty until at least one real runner verifies the combined gate.

Decision: follow the reliability path, not the Composition Clock path yet.

Priority order now:

1. Inspect the latest GitHub Actions Smoke Test run for the commit that added `test:gate`.
2. If Actions passes, create a stable rollback branch or documented rollback tag.
3. If Actions fails, fix only the failing gate step.
4. Only after a passing gate and rollback path, add the Composition Clock primitive so visuals, touch, audio, and weather share one event stream.

## Hosting verdict

Keep Vercel as primary. The current issue is still test visibility and deployment confidence, not provider capability.

Do not migrate until:

1. `npm run test:gate` passes locally or in CI;
2. `npm run test:live` can be run against the deployed public URL with `SITE_URL` set;
3. the site is manually confirmed on iPhone after a tap;
4. a stable branch, rollback branch, or rollback tag exists.

Cloudflare Pages remains the best parallel preview candidate if Vercel previews become unreliable. Netlify is acceptable but not enough stronger to justify churn. GitHub Pages remains a weak primary fit for this experimental app because the project benefits from preview/deploy workflows more than static-only hosting.

## Live-site/test access note

Direct public URL viewing from the available environment has been unreliable. Repository-side checks are therefore the current durable gate. The live hosting test path exists as `npm run test:live`, but it requires `SITE_URL` to be set to the deployed Vercel, Cloudflare Pages, Netlify, or GitHub Pages URL before execution.

## Rule for future automations

Every future feature cycle should include one of:

- static contract check result;
- smoke test run result;
- live hosting test result;
- proof that test execution was unavailable;
- a next-action note explaining the blocker.

No new creative layer should be added without checking mobile stability or explaining why the check could not be performed.
