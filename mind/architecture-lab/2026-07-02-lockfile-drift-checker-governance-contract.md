# Lockfile Drift Checker Governance Contract

Date: 2026-07-02
Status: architecture contract / pre-implementation note
Scope: MC agency validation, schema governance, standalone validator generation
Public-safety level: public-safe; no private user material included

## Architecture question

How should MC implement the smallest lockfile drift checker so it proves `package.json` / `package-lock.json` consistency, records a lockfile hash for validator provenance, and runs before `generate-validators.mjs` without coupling to the app build?

## Current repository fact

The repository currently has `package.json`, but no committed root `package-lock.json` was available when this note was written. That means a real drift checker cannot be enforced yet. The first implementation step must be creation/commit of the lockfile, ideally in the same dependency-governance change that introduces Ajv as a dev dependency.

## Research basis

Current npm documentation establishes four useful constraints:

1. `package-lock.json` is generated when npm modifies `node_modules` or `package.json`; it records the exact generated dependency tree so later installs can recreate the same tree.
2. npm intends `package-lock.json` to be committed because it gives teammates, deployments, and CI the same dependency tree and exposes dependency-tree changes through source-control diffs.
3. `npm ci` requires an existing lockfile and exits with an error when package-lock dependencies do not match `package.json`; it never writes to `package.json` or lockfiles, so it is the correct frozen-install gate.
4. `npm install --package-lock-only` updates only the lockfile, while `--ignore-scripts` prevents lifecycle scripts from running. This makes it useful for a local/proposed-lockfile generation lane, but not as the CI drift gate.

References:
- https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/
- https://docs.npmjs.com/cli/v10/commands/npm-ci/
- https://docs.npmjs.com/cli/v10/commands/npm-install/

## Decision

Use a two-phase governance pattern.

### Phase 1: lockfile establishment

When Ajv is introduced, create the first root `package-lock.json` with a deliberate dependency-governance command such as:

- `npm install --save-dev ajv --package-lock-only --ignore-scripts`

Then commit both:

- `package.json`
- `package-lock.json`

This phase is not the agency runtime lane. It is a governance change that creates provenance for schema-validator generation.

### Phase 2: lockfile drift checker

After the lockfile exists, add a small dependency-free checker at:

- `tools/agency-validation/check-lockfile-drift.mjs`

The checker should run before `generate-validators.mjs` and perform only deterministic file checks:

1. Confirm `package.json` exists.
2. Confirm `package-lock.json` exists.
3. Parse both as JSON.
4. Confirm the lockfile root package entry exists at `packages[""]`.
5. Confirm the root lockfile package name/version match `package.json` when present.
6. Confirm every direct dependency/devDependency/optionalDependency/peerDependency declared in `package.json` appears in the root lockfile package section under the matching dependency class when that class exists.
7. Compute SHA-256 hashes for `package.json` and `package-lock.json` bytes.
8. Emit a compact machine-readable result for validator provenance.

The checker should not resolve packages, contact the registry, run npm install, inspect `node_modules`, or validate the whole npm dependency graph. Full dependency-tree consistency belongs to `npm ci`.

## Required output shape

The checker should emit a small JSON object to stdout and optionally to a path argument:

```json
{
  "contract": "mc.lockfile-drift-check.v1",
  "status": "pass",
  "package_json_sha256": "...",
  "package_lock_sha256": "...",
  "lockfile_version": 3,
  "root_package": {
    "name": "mirror-cartographer-creation-portal",
    "version": "1.0.0"
  },
  "checked_at": null
}
```

`checked_at` should stay `null` unless a later provenance policy explicitly accepts timestamps. Hashes are enough for freshness; timestamps create nondeterministic artifacts.

## Failure classes

Use stable failure labels instead of prose-only failures:

- `missing-package-json`
- `missing-package-lock`
- `invalid-package-json`
- `invalid-package-lock-json`
- `missing-root-lock-package`
- `root-name-mismatch`
- `root-version-mismatch`
- `dependency-class-mismatch`
- `dependency-entry-missing`
- `internal-error`

## CI placement

The final governance lane should be:

1. `npm ci --ignore-scripts`
2. `node tools/agency-validation/check-lockfile-drift.mjs --write mind/generated/lockfile-drift-result.v1.json`
3. `node tools/agency-validation/generate-validators.mjs --verify`
4. `npm run verify:agency`

This ordering keeps the lockfile and Ajv provenance checks ahead of validator generation, while the agency runner remains isolated from Ajv and app-build concerns.

## Non-goals

This checker must not:

- replace `npm ci`,
- mutate `package-lock.json`,
- call `npm install`,
- run lifecycle scripts,
- import Ajv,
- import the Vite/React app,
- become part of `run-fixture-parity.mjs`.

## Durable design pattern

Name: `Frozen dependency governance before generated evidence`

Meaning: generated validators are evidence artifacts. Before generating them, MC must prove the dependency-governance substrate is frozen enough to make the generator reproducible. The lockfile checker supplies byte-level provenance; `npm ci` supplies dependency-tree enforcement; generated-validator metadata records the hashes.

## Next implementation step

Add Ajv as a dev dependency and commit the first `package-lock.json`. Then implement `check-lockfile-drift.mjs` as a dependency-free script and wire it before `generate-validators.mjs` in the schema-governance lane.

## Next architecture question

How should MC add Ajv as a dev dependency and produce the first committed `package-lock.json` while preserving the existing dependency-free agency runner lane and avoiding accidental Playwright/Vite build coupling in schema-governance CI?
