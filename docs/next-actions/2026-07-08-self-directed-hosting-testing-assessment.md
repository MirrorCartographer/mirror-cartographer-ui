# Self-directed hosting/testing assessment

Status: advisory next-action record.
Privacy: public-safe.
Site constraint: phone-first, wordless visible interface, tap-to-start Web Audio, low CPU.

## Combined automation run

The three active loops were evaluated together:

1. Self-Rewriting Forge
2. Self-Branching Composer
3. Self-Auditing Gate

## Decision

Keep the three-loop setup, but treat it as a staged control system rather than three independent feature generators.

- Self-Rewriting Forge should own the build/action lane.
- Self-Branching Composer should own musical/capability exploration.
- Self-Auditing Gate should veto unsafe complexity and force testing/hosting checks.

This setup is good if every run writes or reports a next suggested action. It is bad if every run adds a new feature without checking live behavior.

## Hosting assessment

Vercel remains acceptable for now because the app is a Vite/React static build and Vercel gives fast Git-based deploys and rollbacks. Do not migrate yet.

Current risk is not mostly the host. Current risk is insufficient test visibility: the system can commit code faster than it can verify iPhone audio and live rendering.

Cloudflare Pages should be the first alternate host to test if deployment rate limits or preview instability keep blocking iteration. Cloudflare Pages has a clear static-site fit and generous preview/build model, but migration should be treated as parallel validation, not replacement until proven.

GitHub Pages is a weak primary fit for this project because the hourly/self-directed workflow can exceed its soft build rhythm and it is less suitable as the main experimental deployment surface.

Netlify remains possible, but no migration should happen before we build a repeatable test harness.

## Testing assessment

The missing primitive is a reproducible viewing/test route.

Best next implementation target:

Create a lightweight `npm run smoke` or Playwright test that verifies:

- the app renders without React/runtime errors;
- the sky button exists;
- first pointer/tap calls the music start path;
- the page does not expose visible explanatory text;
- the build completes with `npm run build`;
- mobile viewport loads without console errors.

Audio cannot be fully heard by automation, but the test can verify that the Web Audio path is constructed and tap-unlocked without throwing.

## Suggested next action

Implement a local smoke-test harness before adding more music features.

Preferred smallest change:

- Add `tests/smoke.spec.js` for Playwright.
- Add `test:smoke` script.
- Test mobile viewport, canvas/button existence, pointer down, and console-error capture.

Fallback if GitHub writes block:

- Create a small spec file under `docs/testing/` describing the exact test harness.

## Do not do next

- Do not migrate away from Vercel yet.
- Do not add another musical voice before smoke testing.
- Do not create a separate repo until we have a stable branch strategy.

## Recommended branch/repo strategy

Keep current repository as canonical.

Add a stable/release branch later if available tooling supports branch deploys cleanly:

- `main`: experimental automation commits.
- `stable`: last manually confirmed phone-working version.

Only migrate host after `stable` exists and a smoke test passes.
