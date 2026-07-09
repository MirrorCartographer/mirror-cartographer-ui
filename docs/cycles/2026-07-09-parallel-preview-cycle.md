# Self-directed build cycle — parallel preview lane

Date: 2026-07-09

## Read first

Latest inspected cycle note: `docs/cycles/2026-07-09-preview-harness-cycle.md`.

Its next action was:

1. run `npm run test:preview-url:unit`;
2. run multi-host `SITE_URLS` preview verification;
3. run live smoke against the passing URL;
4. only then wire `phraseMemory`.

## Current verification result

GitHub/Vercel commit status for latest inspected commit `c58f0aba95381eb75646a748cda74cb5d2781b51` reports Vercel failure with a build-rate-limit upgrade URL.

Public web search did not return a usable indexed result for the Vercel URL from this tool session, so live visual/browser proof is still missing.

## Decision

I branched away from phrase-memory wiring.

Reason: the current bottleneck is deployment confidence, not composition capability. Adding phrase memory before a reachable preview lane would make failures harder to localize.

## Host / repo verdict

- Keep the current GitHub repository.
- Keep Vercel as default/stable host, but treat it as currently rate-limited.
- Add Cloudflare Pages as the strongest parallel preview lane.
- Netlify remains fallback two.
- GitHub Pages remains lower priority because the private repo and base-path mechanics add friction.
- A separate stable repo is not justified yet.

## Implemented change

Committed `docs/hosting/parallel-preview-lane.md`.

Commit: `e848e5a8cfc36e104a96d8bf1e1cf7868a7cb854`

It records the minimum Cloudflare Pages setup and the exact multi-host gate sequence.

## Blocked attempt

Attempted to add `public/_headers` for static preview cache control. The write payload was blocked by tool safety checks. I did not keep retrying that path because `public/_redirects` already exists and the highest-value durable change was documenting the second preview lane clearly.

## Preserved constraints

- no autoplay
- tap-to-start remains required
- no visible explanatory words added to the app
- phone-first stability preserved
- no extra scheduler
- no instrument added

## Next suggested action

Use the current host bottleneck directly:

1. Create/connect Cloudflare Pages from this repo.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Then run:

`SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:preview-url`

5. Then run:

`SITE_URL=<passing-url> npm run test:live`

Only after one URL passes remote gates, wire `phraseMemory` into the existing mark/composition flow without UI text, autoplay, new instruments, or a higher CPU budget.
