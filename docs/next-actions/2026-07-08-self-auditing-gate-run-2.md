# Self-Auditing Gate run 2

Status: pruning cycle completed with write-block fallback.

## Inspected state

Latest active note says the project now has:

- `tests/smoke.spec.js`
- `playwright.config.js`
- `npm run test:smoke`
- `scripts/phone-contract-check.mjs`

The static checker verifies phone-first invariants without a browser runner.

The smoke workflow exists at `.github/workflows/smoke.yml`, but it currently uses `npm ci`. The repository does not appear to have a committed lockfile in the inspected state, so CI can fail before the actual phone/smoke gates run.

## Decision

Block novelty again.

Do not add music, weather, or visual complexity until the reliability gate itself can execute.

The correct next action is not Composition Clock yet. The correct next action is to make the existing gate runnable in CI and then inspect the run result.

## Attempted implementation

Tried to patch `.github/workflows/smoke.yml` so dependency install falls back safely when no lockfile is present, and to add the static contract check before the Playwright browser smoke test.

Tried smaller package-script patch to expose:

- `npm run test:contract`

Both direct code/config edits were blocked by the current write filter.

## Hosting/testing gate

Vercel remains suitable as primary hosting. The deployment host is not the current bottleneck.

Current bottleneck:

- CI/test execution wiring is fragile.
- Live public-url viewing from available tools has previously been unreliable.
- The repo needs a passing automated gate before more creative changes.

Cloudflare Pages remains the best parallel preview candidate only if Vercel preview visibility or deployment reliability becomes the blocker. Netlify is acceptable but not a clear upgrade. GitHub Pages remains weak as a primary host for this app because the workflow is experimental and deployment feedback matters more than static hosting simplicity.

No separate stable repo yet. Prefer a `stable` branch later after one passing smoke gate.

## Exact next patch

When config writes are available, patch `.github/workflows/smoke.yml`:

1. Replace `npm ci` with a lockfile-aware install:

```sh
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
```

2. Add a static contract step before Playwright install:

```sh
node scripts/phone-contract-check.mjs
```

3. Then keep:

```sh
npm run build
npm run test:smoke
```

Optional smaller patch:

Add this to `package.json` scripts:

```json
"test:contract": "node scripts/phone-contract-check.mjs"
```

## Next suggested action

Fix CI install/test wiring first. Then inspect the Actions result. Only if the static contract and Playwright smoke test pass should the next run add the Composition Clock primitive.
