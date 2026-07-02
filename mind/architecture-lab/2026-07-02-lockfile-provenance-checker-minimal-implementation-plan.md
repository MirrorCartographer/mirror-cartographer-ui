# Lockfile Provenance Checker — Minimal Implementation Plan

Date: 2026-07-02
Status: design artifact / executable preflight plan
Public-safety: contains no private user material; describes repository architecture only.

## Architecture question

How should MC implement the minimal `check-lockfile-provenance.mjs` and test harness so the gate is executable immediately after the first npm-generated Ajv lockfile lands?

## Current repository constraint

The repository is still before the Ajv lockfile substrate:

- `package.json` exists.
- `package-lock.json` is not yet present in the fetched default branch state.
- Ajv is not yet listed in `devDependencies`.

Therefore this run should not add generator code that claims executable validator provenance exists. The correct durable change is a precise implementation contract for the next code change.

## Researched basis

Current source concepts used:

- npm documents `package-lock.json` as an automatically generated description of the exact dependency tree, intended to be committed so teammates, deployments, and CI install the same dependencies.
- npm documents `npm ci` as the clean-install CI path that requires an existing lockfile and fails when `package.json` and the lockfile are not in sync.
- Node exposes `crypto.createHash()` for deterministic SHA-256 hashing of file bytes.
- Node exposes the built-in `node:test` runner, making a dependency-free checker test harness possible.

## Useful concepts extracted

### 1. The checker is not the installer

`check-lockfile-provenance.mjs` must never mutate dependency state. It must not run `npm install`, write `package-lock.json`, or repair drift. It reads existing files and exits with stable result codes.

### 2. `npm ci` remains the dependency-tree authority

The checker should assume CI has already run or will run `npm ci`. The checker adds machine-readable provenance extraction and project-specific boundary checks that `npm ci` does not express directly.

### 3. Provenance is byte-based, not timestamp-based

The checker records SHA-256 hashes for:

- `package.json`
- `package-lock.json`
- optionally the emitted provenance JSON itself after deterministic serialization

The validator generator later embeds these hashes into validator metadata.

### 4. Ajv must be dev-only

Ajv may exist only under `devDependencies` in `package.json` and under the dev dependency tree in `package-lock.json`. It must not become an app/runtime dependency.

### 5. Failure codes must be stable

The checker should produce deterministic, machine-readable failures before validator generation. This lets CI route failures without parsing prose.

## Proposed file

`tools/schema-governance/check-lockfile-provenance.mjs`

## Proposed command

Add only after Ajv and the lockfile exist:

`"verify:lockfile-provenance": "node tools/schema-governance/check-lockfile-provenance.mjs"`

This command belongs to a schema-governance lane, not the dependency-free agency runner lane.

## Minimal checker behavior

Inputs:

- root `package.json`
- root `package-lock.json`

Outputs:

- stdout: deterministic JSON report
- exit code: stable status

Required successful report fields:

- `ok: true`
- `schema_version: "lockfile-provenance-report.v1"`
- `package_json_sha256`
- `package_lock_sha256`
- `lockfile_version`
- `root_package_name`
- `ajv_package_spec`
- `ajv_lock_version`
- `ajv_is_dev_dependency: true`
- `runtime_lane_contaminated: false`

Required failure report fields:

- `ok: false`
- `schema_version: "lockfile-provenance-report.v1"`
- `code`
- `message`
- any available partial hashes or parse context

## Stable failure codes

- `PACKAGE_JSON_MISSING`
- `PACKAGE_JSON_INVALID_JSON`
- `PACKAGE_LOCK_MISSING`
- `PACKAGE_LOCK_INVALID_JSON`
- `AJV_MISSING_FROM_DEV_DEPENDENCIES`
- `AJV_PRESENT_IN_RUNTIME_DEPENDENCIES`
- `AJV_MISSING_FROM_LOCKFILE`
- `AJV_LOCK_ENTRY_NOT_DEV`
- `LOCK_ROOT_MISMATCH`
- `UNSUPPORTED_LOCKFILE_VERSION`
- `INTERNAL_CHECKER_ERROR`

## Minimal implementation algorithm

1. Resolve repository root from `process.cwd()`.
2. Read `package.json` and `package-lock.json` as raw UTF-8 bytes.
3. Compute SHA-256 over the exact bytes read from disk.
4. Parse both files as JSON.
5. Verify root package name/version consistency between `package.json` and lockfile root package entry.
6. Verify lockfile version is supported, initially v2 or v3.
7. Verify `package.json.devDependencies.ajv` exists.
8. Verify `package.json.dependencies.ajv` does not exist.
9. Locate `node_modules/ajv` in `package-lock.json.packages`.
10. Verify the Ajv lock entry has a concrete `version`.
11. Verify the Ajv lock entry is dev-scoped where the lockfile format exposes `dev: true`.
12. Emit deterministic JSON with sorted keys or explicitly ordered construction.
13. Exit `0` on success; exit nonzero on stable failure.

## Test harness plan

File:

`tools/schema-governance/check-lockfile-provenance.test.mjs`

Use Node built-ins only:

- `node:test`
- `node:assert/strict`
- `node:fs/promises`
- `node:os`
- `node:path`
- `node:child_process`

Fixture approach:

- Create temporary directories per test.
- Write minimal synthetic `package.json` and `package-lock.json` files.
- Execute the checker with `cwd` set to the temp directory.
- Assert stdout JSON, exit code, and stable failure code.

Required first tests:

1. passes with Ajv in `devDependencies` and lockfile `packages["node_modules/ajv"].dev === true`
2. fails when `package-lock.json` is missing
3. fails when Ajv is missing from `devDependencies`
4. fails when Ajv appears in runtime `dependencies`
5. fails when Ajv is missing from the lockfile packages map
6. fails when Ajv lock entry is not dev-scoped
7. reports stable SHA-256 hashes for package and lock bytes

## CI order

The schema-governance lane should run in this order:

1. `npm ci`
2. `npm run verify:lockfile-provenance`
3. `npm run generate:validators -- --check`
4. validator self-tests

The dependency-free agency runner lane remains separate and must not import Ajv or require `node_modules`.

## Design decision

Do not add executable checker code until the npm-generated Ajv lockfile lands. The next code change should introduce Ajv, commit the generated lockfile, then add the checker and its tests in the same branch or immediately following branch.

## Next research question

How should MC represent `lockfile-provenance-report.v1` as a tiny JSON schema and fixture set so the checker output can be contract-tested without requiring Ajv inside the checker itself?
