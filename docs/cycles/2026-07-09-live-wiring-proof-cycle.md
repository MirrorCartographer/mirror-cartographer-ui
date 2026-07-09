# Live wiring proof cycle — 2026-07-09

## Read first

The previous handoff said to run the static phone gates and browser smoke, then only wire phrase memory into `App.jsx` if those gates pass. This cycle revised that path because a more basic accuracy issue remained: the live smoke route previously had a filename/config mismatch, and a prior review noted that the change had not proven which file was actually wired.

## Verified this cycle

- `package.json` currently exposes `test:live` as `playwright test --config=playwright.live.config.js --reporter=line`.
- `playwright.live.config.js` currently uses `SITE_URL`, defaults to `https://mirror-cartographer-ui.vercel.app`, and matches `live-hosting.spec.js` under `./tests`.
- `tests/live-hosting.spec.js` currently contains the deployed preview smoke contract, uses the audio context probe, asserts zero audio contexts before tap, asserts audio context creation after tap, and preserves the wordless body check before and after interaction.
- The latest inspected commit before this cycle was `64de5326bd5e14af1423fa7b5aac878f1d65666a` (`Record static syntax gate cycle`). Its combined status reported Vercel failure with a build-rate-limit target URL and no GitHub Actions workflow runs visible through the available connector.

## Decision

Do not add phrase memory or new audio-visual behavior yet. The stronger path is to encode the live smoke wiring proof directly into the static gate so the repository catches future drift between:

1. `package.json` script;
2. Playwright live config;
3. actual live smoke spec file;
4. no-autoplay/wordless live contract assertions.

## Implementation

Added `scripts/live-wiring-check.mjs` at commit `8b18d7628ea78c43509a04217022a2fe66452da8`.

Updated `scripts/run-phone-gates.mjs` at commit `2b83dd6d4a40dac6d3a19f6311d4af04a7a1b546` so the phone gate now runs:

- syntax check for `scripts/live-wiring-check.mjs`;
- live smoke wiring check before production build.

The check fails if:

- `test:live` is missing;
- `test:live` does not use `playwright.live.config.js`;
- the live config stops reading `SITE_URL`;
- stale `LIVE_SITE_URL` reappears;
- the configured live spec file does not exist;
- the live spec loses the deployed-preview smoke contract;
- the live spec loses the audio context probe;
- the live spec loses the wordless body assertion helper.

## Hosting/testing assessment

- Vercel is not currently proven as the reliable preview lane. The latest inspected pre-cycle commit was build-rate-limited; the post-patch commit reported only a pending Vercel status when checked, not a successful deployment.
- Cloudflare Pages remains the strongest independent preview lane for this Vite static app using build command `npm run build` and output directory `dist`.
- Netlify remains a valid fallback static host.
- GitHub Pages is more feasible now that relative asset base exists, but it remains lower priority than Cloudflare or Netlify unless repository-subpath routing is explicitly validated.
- A different repository is not needed for this patch. The current private repo is safe for small proof/reliability commits. Branch before wiring phrase memory or adding new composition behavior.

## What remains unverified

- I did not run the gate locally in this environment.
- I did not obtain a public deployment URL that could be opened with a browser/screenshot tool.
- I did not verify a completed Vercel deployment for `2b83dd6d4a40dac6d3a19f6311d4af04a7a1b546`; the available status was pending at inspection time.

## Next suggested action

Run:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`

If both pass, re-check Vercel status for `2b83dd6d4a40dac6d3a19f6311d4af04a7a1b546`. If Vercel succeeds and exposes a public deployment URL, run `SITE_URL=<public-url> npm run test:remote-gate`. If Vercel fails or stays unavailable, deploy the same commit to Cloudflare Pages or Netlify and run the remote gate there.

Only after static gate, browser smoke, and one public remote gate pass should the next cycle wire `createPhraseMemory` into `App.jsx` as a low-frequency internal modulation source. Preserve no autoplay, tap-to-start audio, low CPU, no visible explanatory words, and phone-first stability.
