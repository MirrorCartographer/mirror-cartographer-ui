# Accuracy cleanup — 2026-07-09

Purpose: correct prior run summaries and make the live hosting test path internally consistent before adding creative features.

## Verified from repository state

- Recent commits named in prior summaries exist in GitHub.
- `package.json` includes `test:phone-contract` and `test:smoke`.
- `.github/workflows/smoke.yml` runs dependency install, Playwright Chromium install, phone contract check, build, then smoke test.
- Vercel commit status for `3438851c98b69d30102dff4c9ab9b7accb3294b8` reported failure with target URL pointing to a Vercel build-rate-limit upgrade page.

## Corrected during this cleanup

- `playwright.live.config.js` previously matched `/live\.spec\.js/`, but the actual live test file was `tests/live-hosting.spec.js`.
- `tests/live-hosting.spec.js` previously used `LIVE_SITE_URL`, while the config used `SITE_URL`.
- `package.json` did not expose a `test:live` script.

Current live test command:

`SITE_URL=https://example.pages.dev npm run test:live`

Use the actual deployed Vercel or Cloudflare Pages URL in place of the example URL.

## Still unverified

- Whether the deployed Vercel URL is currently reachable from a normal browser.
- Whether GitHub Actions successfully runs on the latest cleanup commits.
- Whether Cloudflare Pages has been created and has a `*.pages.dev` URL.
- Whether the live deployed site passes the phone-first wordless contract in a real browser.

## Hosting assessment

- Vercel remains the primary host for the private phone-first weather/music site, but the latest checked Vercel status was blocked by build-rate-limit.
- Cloudflare Pages is the best second preview lane for reliability and comparison.
- Netlify and GitHub Pages are possible static-host alternatives, but they do not solve the immediate need better than Cloudflare Pages.

## Suggested next action

Do not add new creative behavior yet. First run or inspect CI for the latest cleanup commit. Then create or verify the Cloudflare Pages deployment for `MirrorCartographer/mirror-cartographer-ui`, get its `*.pages.dev` URL, and run:

`SITE_URL=<deployed-url> npm run test:live`
