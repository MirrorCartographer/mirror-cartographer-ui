# Composition capability cycle — 2026-07-09

## Read first

Current next-action source: `docs/next-actions/2026-07-08-after-smoke-harness.md`.

The active note says the strongest move is still verification, not another creative layer:

1. run `node scripts/phone-contract-check.mjs`;
2. run `npm run test:smoke` when browser execution is available;
3. add CI when workflow writes are available;
4. only then add the Composition Clock primitive.

## Evaluation

The site most needs a better testing route before composition expansion.

Current priorities by risk:

1. Testing route / phone contract — highest value because it protects no autoplay, tap-to-start, wordless surface, and phone shape.
2. Composition structure — next creative layer, but should be gated by a passing contract check.
3. Audio-visual coupling — should be implemented through a shared clock rather than direct ad hoc event calls.
4. Weather mapping — already present enough to defer.
5. Hosting/repository changes — not the blocker yet.

## Host/repo verdict

Keep Vercel as primary for now.

Repository iteration is helping because small docs and source files can still be written. Direct package-script wiring was attempted this cycle and was blocked by the tool safety filter while replacing `package.json`, likely because the payload included existing external iCloud URLs. That is a tool-payload filter issue, not proof of GitHub branch protection.

Cloudflare Pages remains the best later parallel preview host, but migration would add churn before the test path is proven. Netlify is not enough stronger to justify switching. GitHub Pages is weak for this React/Vite experimental app unless the project becomes static-only.

## View/test attempt

A public search for the known Vercel URL returned no searchable result from the available web tool. Direct open was not allowed unless the URL came from a search result or the user message. So this cycle could not confirm the live site visually.

Available concrete test route remains repository-side:

- `node scripts/phone-contract-check.mjs`
- `npm run test:smoke`

## Implementation result

Attempted smallest useful code-path change: add `test:contract` to `package.json`.

Result: blocked by tool safety checks before GitHub accepted/rejected it.

Fallback implemented: this cycle note, preserving the automation state and exact blocker.

## Next suggested action

Do not add an instrument yet.

Next cycle should add a tiny CI-free test runner file that avoids editing `package.json`, for example:

- `scripts/run-phone-gates.mjs`

It should:

1. import or execute `scripts/phone-contract-check.mjs`;
2. print the exact follow-up command for the Playwright smoke path;
3. avoid external URLs in the payload;
4. become the stable command a human or CI can run before creative changes.

After that, if verification is clean, add `src/engine/compositionClock.js` as the shared event stream for visuals, touch, audio, and weather.
