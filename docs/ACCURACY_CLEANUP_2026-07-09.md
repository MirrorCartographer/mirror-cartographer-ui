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

## Self-rewriting forge update — 2026-07-09

Implemented `.github/workflows/build-artifact.yml` at commit `a73d8a07364627613b04ba4b49979195ca5daea5`.

Reason: Vercel still reports build-rate-limit failure on the latest checked cleanup commit, so the project needs a host-independent preview proof path while Cloudflare Pages is not yet connected.

Next action:

1. Inspect the GitHub Actions run for commit `a73d8a07364627613b04ba4b49979195ca5daea5`.
2. If the new artifact workflow passes, inspect or download the `mirror-cartographer-dist` artifact.
3. Then connect Cloudflare Pages using build command `npm run build` and output directory `dist`.
4. After a deployed URL exists, run `SITE_URL=<deployed-url> npm run test:live`.
5. If the workflow fails, inspect logs and patch only the smallest failing build or test issue before adding creative behavior.

Preserve the existing surface contract: no autoplay, tap-to-start audio, low CPU, phone-first stability, no visible explanatory words, and no claim of deployed success until a real URL passes the live test.

## Self-rewriting forge update 02 — 2026-07-09

Observed latest repository commits included composition-clock work after the first hosting cleanup: `ed791542ea89942831e9b65730a390c7c7de7385` and `e70d3c42ea309d8423ce6749e0cfbc2f9e212c89`.

Hosting/testing assessment:

- Vercel is still useful as a primary host when quota is available, but the latest checked commit status still reports a Vercel build-rate-limit failure.
- A separate repository is not necessary for reliability work; the current repo is acceptable for small gate/workflow changes. Use a branch before large aesthetic or behavioral experiments.
- Cloudflare Pages remains the strongest next public preview lane because it can build the same Vite static site with `npm run build` and output `dist`.
- Netlify is a valid fallback if Cloudflare setup stalls.
- GitHub Pages is less ideal for this Vite project unless the base path is handled carefully, because project pages usually live under a repository subpath.

Implemented `.github/workflows/live-smoke.yml` at commit `b1ae00cf58e4690e704f4dba73af93ea89d752c5`.

Reason: the project needed a browser-based live test harness that is independent of any one host. The new workflow accepts a public deployed URL as input and runs `npm run test:live` against that URL with Playwright Chromium.

Next action:

1. Create or verify a Cloudflare Pages deployment for `MirrorCartographer/mirror-cartographer-ui` using build command `npm run build` and output directory `dist`.
2. Copy the resulting `*.pages.dev` URL.
3. Manually run the GitHub Actions workflow `Live URL Smoke` with that URL as `site_url`.
4. If it passes, the project has runtime proof for the phone-first wordless contract on a public preview.
5. If it fails, inspect the uploaded `mirror-cartographer-live-smoke-output` artifact and patch the smallest runtime issue before adding more composition behavior.

## Self-rewriting forge update 04 — 2026-07-09

Latest inspected commit before this cycle: `c508418e346d216814b815ec17b9757642082a41` (`Record clock verification cycle`). The latest available combined status still reports Vercel failure with the build-rate-limit target URL. The available workflow-run lookup returned no runs for that commit.

Decision: continue reliability hardening instead of adding creative behavior. The previous artifact workflow used `npm run test:gate`, which includes Playwright smoke. Unlike `.github/workflows/smoke.yml` and `.github/workflows/live-smoke.yml`, the artifact workflow did not install Playwright Chromium before running the browser gate. That could make the host-independent artifact proof fail before it ever proves the site.

Implemented `.github/workflows/build-artifact.yml` browser install at commit `03dd46b91b28425f086084bc332374932bfc1bc1`.

Hosting/testing assessment:

- Vercel is still not the best active preview lane while quota reports build-rate-limit.
- Cloudflare Pages remains the strongest next live preview path for the current Vite static app.
- Netlify remains a reasonable fallback if Cloudflare setup stalls.
- GitHub Pages remains lower priority unless Vite base-path handling is explicitly configured.
- A different repository is not needed for this reliability patch. Use a branch before larger audio/visual/composition experiments.
- No public live URL was available through the inspected repo state, so live screenshot/runtime proof still requires a deployed URL.

Next action:

1. Inspect the GitHub Actions run for commit `03dd46b91b28425f086084bc332374932bfc1bc1`.
2. If `Static Preview Artifact` passes, inspect/download the `mirror-cartographer-dist` artifact as the host-independent preview proof.
3. Then connect Cloudflare Pages with build command `npm run build` and output directory `dist`.
4. Run `Live URL Smoke` against the resulting `*.pages.dev` URL.
5. If a gate fails, patch the smallest failing reliability issue before adding phrase memory, audio-visual coupling, or emergent composition behavior.

## Self-auditing gate update 09 — 2026-07-09

Latest inspected commits before this cycle showed the project had already moved through artifact workflow hardening and clock verification notes. The most recent note still required inspection of the artifact workflow from `03dd46b91b28425f086084bc332374932bfc1bc1`; commit status for that commit now reports Vercel success, but the available workflow-run lookup returned no runs, so Actions proof is still not verified.

Decision: revise the blocker. Vercel is no longer assumed blocked for the inspected commit, but the system still should not add novelty until the local/browser gate proves the phone-first contract. The safest patch is to encode the no-autoplay rule directly into the smoke test.

Implemented `tests/smoke.spec.js` no-autoplay probe at commit `730d53e52599777091a504d1381464fa6567bb78`. The smoke test now instruments `AudioContext`/`webkitAudioContext`, asserts that zero audio contexts exist before the first tap, then asserts that a context is created only after the user gesture. This protects mobile playback policy, avoids silent autoplay regressions, and keeps the creative surface wordless.

Hosting/testing assessment:

- Vercel remains suitable again if its deploy for the latest commit stays green and exposes a reachable deployment URL.
- Cloudflare Pages remains the best independent preview lane because the app is a Vite static build with output directory `dist`.
- Netlify remains a valid fallback for the same static artifact.
- GitHub Pages remains lower priority unless Vite base path is explicitly configured.
- A separate stable repo is not needed yet; use a branch or tag once the no-autoplay smoke gate passes.
- Live proof still requires either a public Vercel deployment URL, a Cloudflare/Netlify preview URL, or a downloaded static artifact served through a browser test.

Next action:

1. Inspect CI/status for commit `730d53e52599777091a504d1381464fa6567bb78`.
2. If the no-autoplay smoke gate fails, patch only the exact failing test/runtime issue.
3. If it passes, create a stable rollback branch or tag from the passing commit.
4. Then run `Live URL Smoke` against the current public deployment URL.
5. Only after local smoke plus live smoke pass should the next run add or revise Composition Clock behavior.

## Self-auditing gate update 10 — 2026-07-09

Latest inspected repo commits before this cycle showed `Record no-autoplay gate cycle` as the newest documented handoff. The latest note required inspection of CI/status for commit `730d53e52599777091a504d1381464fa6567bb78`. The available combined-status check for that commit reports Vercel failure with a build-rate-limit target URL, so Vercel is again not the active proof lane.

Decision: do not add creative behavior. The strongest small patch is to make the static contract verify the same no-autoplay invariant that the browser smoke test verifies: `AudioContext` must not be constructed during app mount, and audio construction must stay behind the `ensure()`/`start()` path reached from tap interaction.

Implemented `scripts/phone-contract-check.mjs` lazy audio assertions at commit `06006fd62b30436982275699459625cfcc0b1de4`.

Hosting/testing assessment:

- Vercel remains useful when quota is available, but the inspected commit currently reports build-rate-limit failure, so it should not be treated as the current reliable preview path.
- Cloudflare Pages remains the strongest next live preview path for this static Vite app using build command `npm run build` and output directory `dist`.
- Netlify remains a valid fallback static host if Cloudflare setup stalls.
- GitHub Pages remains lower priority until Vite base-path handling is explicitly configured.
- The current repository remains acceptable for this reliability patch. Use a branch or tag only after the gate passes, before larger creative/audio/visual experiments.
- No live public URL was available from the inspected repo state, so screenshot/browser proof still requires a Cloudflare/Netlify/Vercel deployment URL or a downloaded artifact served locally.

Next action:

1. Inspect CI/status for commit `06006fd62b30436982275699459625cfcc0b1de4`.
2. If the phone contract fails, patch the exact lazy-audio assertion or runtime structure that failed.
3. If it passes, create a stable rollback branch or tag from the passing commit.
4. Then connect Cloudflare Pages or run `Live URL Smoke` against an available public deployment URL.
5. Only after static gate plus browser smoke pass should the next cycle add composition/audio-visual novelty.

## Self-auditing gate update 11 — 2026-07-09

Latest inspected commits showed `Record lazy audio gate cycle` as the newest documented handoff, with the previous next action requiring CI/status inspection for `06006fd62b30436982275699459625cfcc0b1de4`.

Observed status:

- `06006fd62b30436982275699459625cfcc0b1de4` now has Vercel `success` status.
- The latest handoff commit `1fbc704c091d14b619349d1f1f1750fc05b15d9a` also has Vercel `success` status.
- The available workflow-run lookup returned no GitHub Actions runs, so Actions proof is still not available from the connector.

Decision: follow the previous next action enough to create a rollback point, but block creative novelty until live/browser proof is available. Created stable branch `stable/phone-gate-2026-07-09` at `1fbc704c091d14b619349d1f1f1750fc05b15d9a`.

Hosting/testing assessment:

- Vercel is suitable again as the active deployment lane because both the lazy-audio patch and latest handoff commit report successful Vercel status.
- Cloudflare Pages remains valuable as an independent second preview lane, but no repo-side patch can connect it without external account setup.
- Netlify remains a valid fallback static host if Vercel quota failures return and Cloudflare setup stalls.
- GitHub Pages remains lower priority until Vite base-path handling is configured.
- A separate stable repository is not needed now; the stable branch gives rollback isolation with less operational overhead.
- Live proof is still incomplete because the connector exposed Vercel dashboard target URLs, not a public deployment URL that can be passed into `Live URL Smoke`.

Next action:

1. Find or expose the public Vercel deployment URL for `1fbc704c091d14b619349d1f1f1750fc05b15d9a`, or create/verify a Cloudflare Pages URL.
2. Run `Live URL Smoke` against that URL.
3. If live smoke passes, allow the next smallest Composition Clock integration.
4. If live smoke fails or no public URL can be tested, patch only the live-test/deploy-observability gap before adding novelty.
