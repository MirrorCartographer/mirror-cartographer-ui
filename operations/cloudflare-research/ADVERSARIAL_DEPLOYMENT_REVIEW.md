# Cloudflare Research Team — Adversarial Deployment Review

Date: 2026-07-16
Scope: MirrorCartographer/mirror-cartographer-ui deployment resilience
Branch: preview

## Current verified signal

The latest commit status reports the Vercel context as failed with a target indicating `upgradeToPro=build-rate-limit`. This is not evidence of an application build failure; it is evidence that the current Vercel deployment path is capacity-limited.

## Checkpoint 1 — Before deployment

### Destabilization questions
- Is the deployment provider itself available, or are we mistaking provider quota failure for code failure?
- Are Vercel, GitHub Pages, and a future Cloudflare path duplicating the same responsibility?
- Does each provider have a clearly named role, source branch, build command, output directory, and rollback route?
- Can one provider's quota, cancellation, or webhook race block every verification path?
- Are preview and production artifacts commit-identical and traceable?

### Findings
1. Provider availability is a hidden dependency. Vercel currently reports a build-rate-limit failure.
2. Multiple deployment systems exist or are being introduced without a single authority map.
3. A canceled, skipped, quota-blocked, or superseded deployment can be misread as an application regression.
4. Cloudflare cannot be declared operational until account linkage, project identity, branch mapping, build configuration, environment variables, and a commit-matched public URL are verified.

### Repairs required before implementation
- Treat provider capacity/quota failures as infrastructure-state failures, not application failures.
- Keep `preview` as the integration branch and `main` as production.
- Assign one canonical production provider; other providers must be explicitly labeled preview, fallback, archive, or diagnostic.
- Require commit SHA evidence for every deployment claim.

### Remaining uncertainty
- Whether a Cloudflare Pages or Workers project is already connected.
- Whether Cloudflare credentials or project access are available to this runtime.
- Whether GitHub Pages is intended as fallback production or only a diagnostic mirror.

### Strength assessment
Stronger: yes. The design now distinguishes provider failure from application failure and blocks false promotion evidence.

## Checkpoint 2 — After implementation

### Safe reversible failure experiments
Run only on `preview` or a disposable feature branch.

1. **Wrong output directory test**
   - Temporarily point a test-only deployment configuration at a nonexistent directory.
   - Expected result: deployment fails with a classified artifact-path error.
   - Pass condition: production is untouched and rollback requires one commit revert.

2. **Missing environment variable test**
   - Introduce a non-secret test variable required only by a disposable preview route.
   - Expected result: preview fails with an explicit configuration error.
   - Pass condition: the failure is distinguishable from code/build/provider failures.

3. **Superseded deployment test**
   - Trigger two preview commits in sequence.
   - Expected result: the older run may cancel, but the newer commit must reach a terminal state and be verified by SHA.
   - Pass condition: cancellation is not counted as success or regression.

4. **Rollback test**
   - Deploy a harmless visible preview marker, then revert it.
   - Expected result: the prior known-good artifact is restored or redeployed.
   - Pass condition: rollback time and evidence are recorded.

### Required documentation
For each experiment record: hypothesis, branch, commit, provider, URL, terminal state, observed error class, repair, rollback evidence, and whether the architecture became stronger.

## Checkpoint 3 — Verification

### Verification matrix
- Build command succeeds locally or in CI.
- Output directory exists and contains `index.html`.
- SPA fallback behavior is verified.
- Static assets load from the deployed base path.
- Mobile viewport renders without blocking errors.
- No autoplay occurs.
- Accessibility smoke checks pass.
- Deployed URL maps to the exact commit SHA.
- Provider state is terminal and successful.
- Rollback route is documented and tested.
- No other provider is concurrently claiming canonical production for the same branch without an explicit authority decision.

### Promotion rule
Do not promote when any of the following is true:
- provider quota/rate limit is active;
- deployment is canceled, skipped, queued, or superseded;
- commit identity is unknown;
- critical configuration is inferred rather than verified;
- rollback has not been demonstrated;
- two providers can race to represent production state.

## Immediate next action

Use Cloudflare only as a controlled candidate path until these facts are verified: account/project access, Git integration status, production branch, preview branch, build command (`npm run build`), output directory (`dist`), SPA fallback behavior, environment variables, custom-domain ownership, and commit-matched deployment evidence.
