# Ajv lockfile change set CI-safe runbook

Date: 2026-07-02
Status: Prototype plan / governance runbook
Public safety: private operator context intentionally abstracted; this note describes repository architecture only.

## Architecture question

How should MC introduce the first npm-generated Ajv lockfile change set in a CI-safe way, including exact commands, branch workflow, and verification order, without weakening the dependency-free agency runner lane?

## Research basis

Current source check:

- npm `package-lock.json` documentation says the lockfile is automatically generated when npm modifies `node_modules` or `package.json`, describes the exact generated tree, is intended to be committed, and supports identical dependency installs across teammates, deployments, and CI.
  Source: https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/
- npm `npm ci` documentation says `npm ci` is for automated environments, requires an existing lockfile, exits with an error when the lockfile does not match `package.json`, removes existing `node_modules`, and never writes to package manifests or lockfiles.
  Source: https://docs.npmjs.com/cli/v11/commands/npm-ci/
- npm `npm install` documentation says `-D` / `--save-dev` writes a package to `devDependencies`, and updates an existing lockfile when present.
  Source: https://docs.npmjs.com/cli/v11/commands/npm-install/
- `actions/setup-node` documentation recommends committing lockfiles for security and performance, supports npm cache configuration, uses dependency file hashes in cache keys, and does not cache `node_modules`.
  Source: https://github.com/actions/setup-node

## Repository observation

Fetched root `package.json` shows existing runtime/app dependencies and devDependencies, but Ajv is not yet present in `devDependencies`. A committed `package-lock.json` was not observed in the fetched state during this run.

Current root package split:

- dependencies: `@playwright/test`, `playwright`, `react`, `react-dom`
- devDependencies: `@vitejs/plugin-react`, `vite`
- no `ajv` entry yet

## Decision

Introduce Ajv and the first root `package-lock.json` through npm only. Do not hand-author the lockfile. Do not import Ajv from the runtime agency runner. Treat Ajv as schema-governance infrastructure.

The safe architecture is a two-lane model:

1. Dependency-free agency runner lane
   - Must keep working with only Node built-ins.
   - Owns `run-fixture-parity.mjs` and direct report production.
   - Must not import Ajv, generated validator build tooling, or app build dependencies.

2. Schema-governance lane
   - May use Ajv as a dev dependency.
   - Owns schema compilation, generated validator artifacts, metadata, hash checks, and schema self-tests.
   - Runs after `npm ci` has proven package/lock consistency.

## Exact change-set workflow

Use a branch, not a direct default-branch mutation, for the first dependency-tree introduction:

1. Create branch:
   - `git switch -c architecture/ajv-lockfile-governance`

2. Install Ajv as a dev dependency:
   - `npm install --save-dev ajv`

3. Confirm expected files changed:
   - `package.json`
   - `package-lock.json`

4. Confirm Ajv is only a dev dependency:
   - `node -e "const p=require('./package.json'); if(!p.devDependencies?.ajv) process.exit(1); if(p.dependencies?.ajv) process.exit(2);"`

5. Prove the lockfile is frozen-install compatible:
   - `rm -rf node_modules`
   - `npm ci`

6. Run dependency-free agency verification separately:
   - `npm run verify:agency`

7. Add schema-governance scripts only after the lockfile exists:
   - `verify:lockfile`
   - `generate:validators`
   - `test:validators`
   - `verify:schema-governance`

8. Commit as one dependency-governance change:
   - `package.json`
   - `package-lock.json`
   - the runbook or issue linking this decision

## CI verification order

Recommended independent jobs:

### agency-validation

Purpose: fast evidence-lane verification.

Order:

1. checkout
2. setup Node
3. no `npm ci` required unless existing scripts demand it
4. `npm run verify:agency`

Rule: this lane must not require Ajv.

### schema-governance

Purpose: standards validation and generated-validator provenance.

Order:

1. checkout
2. setup Node with npm cache keyed by `package-lock.json`
3. `npm ci`
4. `npm run verify:lockfile`
5. `npm run generate:validators -- --check`
6. `npm run test:validators`
7. upload generated-validator report artifacts if applicable

Rule: this lane may depend on Ajv, but must prove any generated validator is fresh relative to schema bytes, validator bytes, and lockfile SHA-256.

## Requirements update

Add these requirements to the schema-governance track:

- REQ-SG-001: `package-lock.json` must be npm-generated and committed; handwritten lockfile introduction is invalid.
- REQ-SG-002: `npm ci` is the frozen install authority for package/lock consistency in CI.
- REQ-SG-003: Ajv must live in `devDependencies`, not `dependencies`.
- REQ-SG-004: The dependency-free agency runner must not import Ajv or any generated-validator build-time code.
- REQ-SG-005: Validator provenance metadata must include the `package-lock.json` SHA-256 and the resolved Ajv package version.
- REQ-SG-006: GitHub Actions npm caching may be enabled for schema-governance jobs, but cache correctness must be derived from lockfile hash, not `node_modules` reuse.

## Useful concepts extracted

- Lockfile as provenance surface: the lockfile is not just install convenience; it becomes the byte-level record of the dependency tree used to generate validators.
- Frozen install as gate: `npm ci` is the clean boundary between local mutation and CI verification because it refuses manifest/lock mismatch.
- Dev dependency containment: Ajv is allowed only where standards validation/generation happens.
- Lane separation: MC needs independent CI lanes so app build failures, validator drift, and agency report failures remain diagnostically separate.
- Hash-coupled validators: generated validator metadata should bind schema hash, validator hash, lockfile hash, Ajv version, Node version, generator version, and isolation level.

## What changed in understanding

The next useful implementation is not `generate-validators.mjs` yet. The immediate missing substrate is a CI-safe dependency introduction boundary. Without a committed npm-generated lockfile, validator metadata cannot honestly claim Ajv provenance or reproducible dependency resolution.

The lockfile is therefore the first schema-governance artifact that must exist before generated validator code is trusted.

## Next research question

How should MC implement `check-lockfile-provenance.mjs` as the first executable schema-governance preflight so it extracts Ajv version, computes package/lock hashes, verifies Ajv is dev-only, and exits with stable machine-readable failure codes before validator generation?
