# Self-Auditing Gate 12

Status: reliability gate advanced; novelty remains blocked.

## Inspected state

The latest actionable direction was to verify the live URL gate before starting the Composition Clock primitive.

Direct inspection found two gate mismatches:

1. `package.json` had `test:remote-gate`, but `test:gate` only ran `test:local-gate`.
2. `tests/live-hosting.spec.js` skipped unless `SITE_URL` was explicitly set, even though `playwright.live.config.js` already defines a default public Vercel URL.

That meant the previous live-testing gate could appear present while not actually being enforced by the consolidated CI command.

## Decision

Follow the previous action in revised form: enforce live smoke as part of the consolidated gate before any new music/weather/composition work.

Novelty remains blocked until CI proves the full gate passes.

## Implemented

- Updated `test:gate` to run both local and remote gates:
  - `test:phone-contract`
  - `build`
  - local Playwright smoke
  - public URL fetch check
  - live phone Playwright smoke
- Removed the `SITE_URL`-required skip from the live hosting smoke so the configured default public URL is actually tested.

## Hosting/testing gate

Vercel remains suitable for now because it provides the public URL already wired into `scripts/preview-url-check.mjs` and `playwright.live.config.js`.

Cloudflare Pages or Netlify should only be added if the full gate fails because Vercel is unavailable, rate-limited, or produces deployment instability unrelated to app code.

GitHub Pages is lower priority because this is a Vite/React app with interactive phone/audio behavior, and Vercel/Cloudflare/Netlify previews are better suited for deploy preview workflows.

A separate stable repo is unnecessary now because a stable rollback branch already exists. Prefer release tag or protected stable branch after the full gate passes.

## Next suggested action

Inspect GitHub Actions for the commits that changed `test:gate` and live smoke. If green, create a release tag or stable marker before beginning the smallest Composition Clock primitive. If red, fix only the failing gate step and do not add creative layers.
