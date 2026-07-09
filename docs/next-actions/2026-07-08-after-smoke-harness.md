# Next action after smoke harness

Status: active next-action note.

## What changed

A phone-first Playwright smoke harness exists:

- `tests/smoke.spec.js`
- `playwright.config.js`
- `npm run test:smoke`

The harness checks mobile render, sky button/canvas presence, first tap survival, console/page errors, and the wordless visible surface.

## Current cycle update

A static phone-contract checker was added at `scripts/phone-contract-check.mjs`.

It verifies the core invariants without needing a browser runner:

- tap-to-start remains pointer based;
- music start remains inside the interaction path;
- the visible surface remains a canvas inside the sky button;
- no visible instruction copy appears in the app body;
- the smoke test and Playwright config still target a touch-capable phone-shaped viewport.

Attempted package-script wiring for `test:contract` was blocked by the current write filter while editing `package.json`, so the script is currently run directly:

`node scripts/phone-contract-check.mjs`

## Self-directed automation verdict

The setup is better, but still incomplete until at least one test path is executed by a real runner.

Priority order now:

1. Run `node scripts/phone-contract-check.mjs` as the lowest-friction invariant check.
2. Run `npm run test:smoke` when Playwright/browser execution is available.
3. Add `.github/workflows/smoke.yml` when workflow-file writes are available.
4. Only after a passing gate, add the Composition Clock primitive so visuals, touch, audio, and weather share one event stream.

## Hosting verdict

Keep Vercel as primary. The blocking issue is still test visibility, not hosting.

Do not migrate until:

1. the static contract check passes;
2. `npm run test:smoke` passes locally or in CI;
3. the site is manually confirmed on iPhone after a tap;
4. a stable branch or rollback rule exists.

Cloudflare Pages remains the best parallel preview candidate if Vercel previews become unreliable. Netlify is acceptable but not enough stronger to justify churn. GitHub Pages remains a weak primary fit for this experimental app.

## Live-site/test access note

This run attempted direct live-site access from the available execution environment, but DNS/tool access did not resolve the public Vercel URL. Because the live view was unavailable, the cycle improved repository-side verification instead of adding a new creative layer.

## Rule for future automations

Every future feature cycle should include one of:

- static contract check result;
- smoke test run result;
- proof that test execution was unavailable;
- a next-action note explaining the blocker.

No new creative layer should be added without checking mobile stability or explaining why the check could not be performed.
