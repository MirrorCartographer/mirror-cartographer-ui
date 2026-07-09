# Gate run 15 — live wiring remote gate

Decision: block novelty; reliability path advanced.

Latest inspected action: previous run said to patch `package.json` so `test:live-wiring` runs first inside `test:remote-gate`.

Assessment:
- Follow/revise: follow the intent, but revise the implementation target.
- `package.json` already exposes `test:live-wiring` and runs it before preview/live smoke in `test:remote-gate`.
- The remaining risk was regression: `scripts/live-wiring-check.mjs` verified the live spec/config path, but did not verify that the wiring check itself was included in the remote gate.

Implemented:
- Strengthened `scripts/live-wiring-check.mjs` so it fails if:
  - `scripts.test:live-wiring` is missing.
  - `scripts.test:live-wiring` does not run `scripts/live-wiring-check.mjs`.
  - `scripts.test:remote-gate` is missing.
  - `scripts.test:remote-gate` does not run `npm run test:live-wiring` before live checks.

Hosting/testing gate:
- Vercel remains suitable as the primary host only while public URL smoke stays green.
- Because the repo already has preview URL detection, live Playwright smoke, and blocked-Vercel-page detection, do not branch to Cloudflare Pages/Netlify/GitHub Pages yet.
- Branch to Cloudflare Pages or Netlify proof only if the live URL gate fails because of repeated Vercel build-rate-limit/account-page behavior, not because of app code.
- Keep the stable rollback branch/tag path before adding new Composition Clock work.

Next suggested action:
1. Inspect GitHub Actions for commit `861b361`.
2. If green, create a release/stable marker for the current phone gate.
3. If red, fix only the failing gate step.
4. Do not add new weather/music novelty until the full gate is green.
