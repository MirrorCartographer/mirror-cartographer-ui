# Smoke gate run 1

Status: gate partially improved, not passed.

## Latest inspected next action

The active next action said to add `.github/workflows/smoke.yml` when workflow-file writes were available, then run the smoke harness on push and pull request.

## Action taken

A GitHub Actions workflow was added at `.github/workflows/smoke.yml`.

## Gate finding

The workflow currently uses `npm ci`, but this repository does not currently contain `package-lock.json`.

That means the workflow is likely to fail during dependency installation unless either:

1. a lockfile is added, or
2. the workflow install step is changed from `npm ci` to `npm install`.

An attempt to patch the workflow from `npm ci` to `npm install` was blocked by the available write path after the workflow file had already been created.

## Decision

Block novelty. Do not add more audio or visual complexity yet.

The smallest safe next action is to fix the smoke workflow install step or add a valid lockfile, then check whether the workflow run appears for the latest commit.

## Hosting/testing assessment

Vercel remains suitable for the public static Vite site. Hosting migration is not the immediate bottleneck.

Cloudflare Pages remains the best parallel candidate if Vercel preview/deploy visibility becomes unreliable, but migrating before the test gate passes would only move the same unverified build to a new host.

Netlify is acceptable but not compelling enough to justify churn right now.

GitHub Pages remains weak as the primary deployment surface for this project because this app needs fast experimental previews, rollback discipline, and phone/audio verification.

A separate stable repo is not recommended yet. A stable branch is preferable once smoke CI is passing.

## Next suggested action

Fix `.github/workflows/smoke.yml` by either:

- changing `npm ci` to `npm install`, or
- adding a generated `package-lock.json` and keeping `npm ci`.

Then inspect the Actions run for the resulting commit. If the smoke test fails, fix only the smoke failure. If it passes, proceed to the Composition Clock primitive.
