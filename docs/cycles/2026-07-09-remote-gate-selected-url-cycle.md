# Self-directed build cycle — selected URL remote gate

Date: 2026-07-09

## Latest suggested action inspected

The latest cycle note said to run the preview URL harness, then run live smoke against a passing URL, then only after that begin the smallest `phraseMemory` layer.

## Decision

Revise the action and block novelty.

Reason: `test:remote-gate` validated preview candidates and then ran `test:live`, but `test:live` still defaulted to the Vercel URL unless `SITE_URL` was set separately. That meant a second reachable preview candidate could pass preview checking while browser smoke still tested a blocked/default Vercel deployment.

## Hosting / testing gate

- Vercel remains useful as the default host, but this run observed Vercel status as failure with a build-rate-limit upgrade URL on the latest commit.
- Cloudflare Pages is the strongest parallel lane because the app is a static Vite build and the preview checker already supports multiple candidates through `SITE_URLS`.
- Netlify remains a reasonable fallback if Cloudflare setup is blocked.
- GitHub Pages remains lower priority because private repo and base-path behavior can add avoidable deployment friction.
- A separate stable repo is not justified yet. A stable branch/tag plus a second preview host is enough.

## Implemented change

Added `scripts/remote-gate.mjs`.

It now:

1. runs live wiring validation,
2. runs the preview URL unit harness,
3. checks each `SITE_URLS` candidate independently,
4. selects the first reachable preview URL,
5. runs Playwright live smoke with `SITE_URL=<selected-url>`.

Updated `package.json` so `test:remote-gate` runs the new remote gate runner.

Updated `scripts/live-wiring-check.mjs` so it validates the new runner instead of requiring the old inline package script chain.

## Verified

- `package.json` exposes `test:remote-gate` through `scripts/remote-gate.mjs`.
- The runner uses `SITE_URLS` candidates and passes the selected candidate to `SITE_URL` for live smoke.
- The latest inspected GitHub status for the final wiring commit still shows Vercel failure due to build-rate-limit.

## Unverified

- GitHub Actions for this final patch were not visible in this tool session.
- No Cloudflare Pages or Netlify public URL is configured yet.
- No browser screenshot proof was available from the live site in this run.

## Next suggested action

Add a second public preview URL, preferably Cloudflare Pages, then run:

`SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:remote-gate`

If the remote gate passes, create a release/stable marker. Only then start the smallest `phraseMemory` primitive with no visible explanatory words, no autoplay, no new scheduler, and no higher CPU budget.
