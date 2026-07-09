# Composition / capability cycle — preview candidate routing

Date: 2026-07-09

## Read first

Recent commits showed the site has moved past initial composition-clock wiring and into live/deployment verification:

- `Guard live wiring in remote gate`
- `Record gate run 15 package wiring`
- `Expose live wiring remote gate`
- `Detect blocked Vercel preview pages`

The strongest prior next action was to keep Vercel but add or test a parallel preview lane because Vercel had been returning build-limit/dashboard pages instead of a usable app shell.

## Evaluation

Current need ranking:

1. Testing route / deployment confidence
2. Hosting redundancy
3. Composition structure verification
4. Phrase memory wiring
5. New instrument design

The app already has `createCompositionClock`, `createCompositionFrame`, and tap frame wiring in `src/components/App.jsx`. Adding phrase memory or counterpoint before reliable remote preview confidence would compound uncertainty.

## Host / repo verdict

- Keep the current GitHub repo.
- Keep Vercel as the stable/default host because the app and scripts already target it.
- Add Cloudflare Pages or another static preview host as a parallel candidate, not a replacement.
- A separate stable repo is not justified yet; the bottleneck is preview reachability, not repository organization.

## Concrete test route

`npm run test:remote-gate` now has a stronger first step because `scripts/preview-url-check.mjs` can accept multiple comma-separated candidates through `SITE_URLS`.

Example:

`SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:preview-url`

The script passes on the first reachable valid app shell and reports all candidate failures if none work.

## Implemented change

Updated `scripts/preview-url-check.mjs` to support:

- `SITE_URLS` comma-separated preview candidates
- fallback to existing `SITE_URL`
- fallback to the existing Vercel default
- first-pass success across candidate hosts
- consolidated error output when all candidates fail

Commit: `12ca5185`

## Branch decision

I followed the previous direction rather than wiring phrase memory. The branch is justified because current host confidence is still the structural bottleneck. Behavior work should resume after at least one remote preview lane is consistently reachable and gated.

## Next suggested action

Run:

`SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:preview-url`

Then run:

`SITE_URL=<passing-url> npm run test:live`

If both pass, wire `phraseMemory` into the existing mark/composition flow with no new UI text, no autoplay, and no extra scheduler.
