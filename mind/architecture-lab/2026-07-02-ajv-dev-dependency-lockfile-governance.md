# Ajv dev dependency + lockfile governance

## Architecture question

How should MC add Ajv as a development dependency and introduce the first `package-lock.json` governance rule without contaminating the dependency-free agency runner lane?

## Current repository observation

The current default branch exposes `package.json` with application dependencies and Vite tooling, but no committed `package-lock.json` is present. This means schema-governance work cannot yet rely on `npm ci`, lockfile byte hashes, or deterministic validator provenance.

## Research basis

- npm documents `package-lock.json` as the exact generated dependency tree and says it is intended to be committed so teammates, deployments, and CI install the same dependencies.
- npm documents `npm ci` as the automated-environment install path. It requires an existing lockfile, exits instead of updating the lockfile when `package.json` and the lockfile diverge, removes existing `node_modules`, and never writes to package manifests or lockfiles.
- npm documents `npm install --save-dev` / `-D` as the mechanism that records a package in `devDependencies`, and notes that package-lock is updated when present.
- GitHub Actions Node guidance uses `actions/setup-node` and `npm ci` for dependency installation, with optional npm cache support.

Sources checked 2026-07-02:

- https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/
- https://docs.npmjs.com/cli/v10/commands/npm-ci/
- https://docs.npmjs.com/cli/v10/commands/npm-install/
- https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs

## Decision

Adopt a two-lane dependency rule:

1. Runtime agency runner lane remains dependency-free.
   - `tools/agency-validation/run-fixture-parity.mjs` must not import Ajv.
   - Its tests must continue to run through Node built-ins only.
   - It may consume generated validator artifacts later only as plain ESM modules, not as generator dependencies.

2. Schema-governance lane may use Ajv as a pinned development dependency.
   - Ajv belongs in `devDependencies`, not `dependencies`.
   - The first dependency governance change must introduce `package-lock.json` in the same commit as the Ajv dev dependency.
   - CI jobs that need dependency determinism must use `npm ci`, not `npm install`.
   - Any validator-generation job must fail if `package.json` and `package-lock.json` drift.

## Implementation rule

The first executable validator-generator commit should do this sequence:

1. Add Ajv as a dev dependency using npm's dev dependency path.
2. Commit the resulting `package-lock.json`.
3. Add a `verify:lockfile` or equivalent governance script that checks lockfile presence before validator generation.
4. Add `generate-validators.mjs` only after the lockfile exists, or in the same commit if the lockfile is generated and committed atomically.
5. Keep `verify:agency` independent from the governance lane unless explicitly testing generated validator artifacts.

## CI separation

Recommended lanes:

- `verify:agency`: dependency-free parser/report shell and in-memory tests.
- `verify:schema-governance`: `npm ci`, generate validators, validate metadata, run validator self-tests.
- `build`: app/Vite build.

This preserves error locality: fixture-parity failures should not be hidden behind app build failures, and schema-governance failures should not imply that the runtime runner has gained an Ajv dependency.

## Acceptance criteria

A future implementation is acceptable only if:

- `package-lock.json` is committed.
- Ajv is listed under `devDependencies`, not `dependencies`.
- CI uses `npm ci` for the schema-governance lane.
- The runtime runner imports no Ajv package paths.
- Generated validator metadata records at least: schema path, schema hash, validator path, validator hash, generator path, generator hash, Ajv package version, lockfile hash, isolation level.
- A lockfile drift check fails deterministically before validator generation proceeds.

## Rejected path

Do not add a hand-written partial JSON Schema validator to the dependency-free runner. That would create a false standard-compliance claim and weaken the schema contract.

## Next research question

How should MC implement the smallest lockfile drift checker so it proves `package.json` / `package-lock.json` consistency, records a lockfile hash for validator provenance, and runs before `generate-validators.mjs` without coupling to the app build?
