# Lockfile Provenance Checker Prototype Plan

Date: 2026-07-02
Status: proposed governance artifact
Privacy: public-safe; no private user material included

## Architecture question

How should MC implement `check-lockfile-provenance.mjs` so it verifies package/lock consistency, extracts the Ajv version and lockfile SHA-256, and blocks validator generation unless the dependency tree is reproducible?

## Decision

Implement the checker as a schema-governance preflight gate, not as a package installer and not as runtime runner logic.

The checker should read committed files, compute deterministic evidence, and fail closed when provenance is missing or inconsistent. It should not modify `package.json`, `package-lock.json`, `node_modules`, schemas, generated validators, or reports.

## Why this is the correct boundary

`npm ci` is the authoritative clean-install consistency verifier: it requires an existing lockfile, exits when the lockfile does not match `package.json`, removes an existing `node_modules`, and does not write package manifests or lockfiles.

`check-lockfile-provenance.mjs` should therefore be narrower than `npm ci`. Its role is to extract and normalize provenance for later validator metadata:

- prove the lockfile exists,
- prove Ajv is declared as a dev dependency,
- prove the root lockfile agrees with the root package manifest,
- locate the resolved Ajv lockfile package entry,
- compute `package-lock.json` SHA-256,
- emit a deterministic provenance object for `generate-validators.mjs`,
- return stable exit codes and compact console summaries.

## Non-goals

The checker must not:

- install packages,
- call the npm registry,
- run lifecycle scripts,
- validate full JSON Schema Draft 2020-12 reports,
- import Ajv,
- import generated validators,
- couple to Vite, React, Playwright, or the app build.

## Minimal command surface

Proposed file:

- `tools/agency-validation/check-lockfile-provenance.mjs`

Proposed scripts after a committed npm-generated lockfile exists:

- `verify:lockfile`: runs the provenance checker only.
- `verify:schema-governance`: runs `npm ci`, then `verify:lockfile`, then validator generation/self-tests.

The checker can be used before generator execution as:

- `node tools/agency-validation/check-lockfile-provenance.mjs --json .artifacts/lockfile-provenance.json`

## Required checks

### 1. Root files exist

Required files:

- `package.json`
- `package-lock.json`

Failure class if missing:

- `lockfile-missing`

### 2. Manifest contains Ajv only as dev dependency

Rules:

- `package_json.devDependencies.ajv` must exist.
- `package_json.dependencies.ajv` must not exist.

Failure classes:

- `ajv-dev-dependency-missing`
- `ajv-runtime-dependency-forbidden`

### 3. Lockfile root agrees with manifest

Rules:

- `package_lock.packages[""].devDependencies.ajv` must exist.
- It must equal `package_json.devDependencies.ajv` exactly.

Failure class:

- `ajv-root-range-mismatch`

### 4. Lockfile contains resolved Ajv package entry

Rules:

- `package_lock.packages["node_modules/ajv"]` must exist.
- It must expose a concrete `version`.
- It should expose `resolved` and `integrity` when installed from the npm registry.
- It should be marked as development-only when npm lockfile semantics provide that flag.

Failure classes:

- `ajv-lock-entry-missing`
- `ajv-lock-version-missing`
- `ajv-lock-integrity-missing`

### 5. Lockfile hash is deterministic

Rules:

- Hash raw `package-lock.json` bytes, not parsed JSON.
- Use SHA-256.
- Emit lower-case hex.

Output field:

- `package_lock_sha256`

### 6. Runtime runner remains Ajv-free

Rules:

- The provenance checker may import Node built-ins only.
- The runtime runner and direct runtime-runner support files must not import Ajv.
- Governance tools may import Ajv only after lockfile provenance exists.

Failure class:

- `ajv-runtime-import-forbidden`

## Proposed provenance object

The checker should emit a deterministic JSON object with these fields:

- `schema_version`: `lockfile-provenance.v1`
- `generated_at`: optional; omit from hash-sensitive comparisons unless a timestamp is explicitly required
- `package_json_path`
- `package_lock_path`
- `package_name`
- `package_version`
- `package_lock_lockfile_version`
- `package_lock_sha256`
- `ajv_manifest_range`
- `ajv_lock_version`
- `ajv_lock_resolved`
- `ajv_lock_integrity`
- `ajv_declared_scope`: `devDependencies`
- `provenance_gate`: `lockfile-provenance`
- `status`: `pass` or `fail`
- `failures`: array of stable failure identifiers

## Exit-code map

Suggested stable exit codes:

- `0`: provenance valid
- `2`: CLI parse failure
- `20`: required file missing
- `21`: package/lock mismatch
- `22`: Ajv dependency placement violation
- `23`: Ajv lockfile entry incomplete
- `24`: runtime runner imports Ajv
- `70`: internal checker error

Exit codes are routing labels, not diagnostic evidence. The JSON provenance report is the evidence surface.

## Implementation shape

The checker should export an importable function:

- `checkLockfileProvenance(argv, capabilities)`

Capabilities should include injected file readers and writers so tests can run entirely in memory before touching repository files.

Required capability seams:

- `readFile(path)`
- `writeFile(path, content)`
- `sha256(bytesOrString)`
- `listRuntimeFiles()`

This matches the existing agency-runner pattern: test first in memory, then wire to real filesystem capabilities.

## Test fixtures

Initial tests should cover:

1. Missing `package-lock.json` fails closed.
2. Ajv missing from manifest fails.
3. Ajv in runtime dependencies fails.
4. Ajv manifest range differs from root lockfile range fails.
5. Ajv lock entry missing fails.
6. Valid manifest + lockfile emits stable provenance.
7. Runtime runner import of Ajv fails.
8. Checker does not attempt fixture reads or app build steps.

## Extracted concepts

- `npm ci` is a frozen-install verifier, not a manifest repair tool.
- `npm install --package-lock-only` can update lockfile metadata without installing packages, but it is still a mutating generation command and should not be hidden inside the provenance checker.
- `--ignore-scripts` prevents lifecycle scripts during npm operations, useful for guarded generation lanes, but it does not replace `npm ci` as the clean-install check.
- SHA-256 should be computed from raw bytes so formatting and ordering changes in `package-lock.json` are visible to provenance.
- Lockfile provenance should become an input to generated-validator metadata, not a side effect of validator generation.

## Acceptance criteria

This architecture is ready for implementation when:

1. Ajv has been added through npm as a dev dependency.
2. `package-lock.json` exists and is committed.
3. `npm ci` succeeds from a clean checkout.
4. The checker can run without Ajv installed in the runtime runner path.
5. The checker emits a deterministic provenance report.
6. `generate-validators.mjs` refuses to run without a passing provenance report.

## Current repository implication

At the time of this note, the observed repository root still has `package.json` without a committed `package-lock.json`. Therefore the next implementation step remains blocked on npm-generated lockfile introduction. The durable action in this run is to define the exact checker contract so that the first lockfile can be evaluated immediately once it exists.

## Next research question

How should MC introduce the first npm-generated Ajv lockfile change set in a CI-safe way, including exact commands, branch workflow, and verification order, so the lockfile can be committed without weakening the dependency-free agency runner lane?
