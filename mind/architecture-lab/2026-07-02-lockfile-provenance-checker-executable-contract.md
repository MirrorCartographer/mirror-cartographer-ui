# Lockfile provenance checker executable contract

Date: 2026-07-02

## Architecture question

How should MC implement `check-lockfile-provenance.mjs` as the first executable schema-governance preflight so it extracts Ajv version, computes package and lockfile hashes, verifies Ajv is dev-only, and exits with stable machine-readable failure codes before validator generation?

## Public-safe context

This note abstracts the private reflection system into a general software architecture problem: a repository needs a deterministic schema-governance lane that can later generate standalone validators without contaminating a dependency-free runtime/agency runner lane.

## Current repository observation

The default-branch `package.json` defines an ESM project (`"type": "module"`) and has `dependencies` and `devDependencies`, but Ajv is not yet present in either section. `package-lock.json` is not currently present in the fetched default-branch state. Therefore the checker can be designed now, but executable validator generation must wait until an npm-generated lockfile exists.

## Research basis

- npm documents `package-lock.json` as an automatically generated dependency-tree artifact that should be committed so teammates, deployments, and CI install the same dependency tree.
- npm documents `npm ci` as the clean-install command for CI, requiring an existing lockfile and failing when `package.json` and `package-lock.json` are out of sync rather than rewriting the lockfile.
- npm documents lockfile `packages` entries, including root project metadata and package descriptors with fields such as `version`, `resolved`, `integrity`, and `dev`.
- Node's `crypto.createHash()` supports creating a hash object and digesting bytes, which is sufficient for SHA-256 provenance hashes.
- Node's filesystem APIs can read repository files as bytes before parsing JSON, allowing hashes to reflect exact committed file bytes rather than normalized object content.

Source anchors:

- npm package-lock.json docs: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/
- npm ci docs: https://docs.npmjs.com/cli/v10/commands/npm-ci/
- npm install docs: https://docs.npmjs.com/cli/v10/commands/npm-install/
- Node crypto docs: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
- Node fs docs: https://nodejs.org/api/fs.html#fsreadfilesyncpath-options

## Changed understanding

The provenance checker should not be a package installer, package updater, validator generator, or app-build check. It should be a read-only membrane between dependency governance and schema validator generation.

The important shift is from "prove installability" to "prove preconditions for generation." `npm ci` remains the authoritative frozen-install check. `check-lockfile-provenance.mjs` should inspect committed bytes and package metadata after the repository has a lockfile, then emit a small provenance object that downstream validator generation can embed or compare.

## Required behavior

`tools/schema-governance/check-lockfile-provenance.mjs` should:

1. Read `package.json` and `package-lock.json` as raw bytes.
2. Compute SHA-256 hashes for both files from raw bytes.
3. Parse both files as JSON after hashing.
4. Fail if `package-lock.json` is missing.
5. Fail if Ajv is missing from root `devDependencies`.
6. Fail if Ajv appears in root `dependencies`.
7. Fail if the lockfile root package does not include Ajv under `packages[""].devDependencies`.
8. Fail if `packages["node_modules/ajv"].version` is missing.
9. Fail if the Ajv package entry is not marked as development-only where the lockfile format exposes that flag.
10. Emit deterministic JSON containing at least:
    - `ok`
    - `gate`
    - `package_json_sha256`
    - `package_lock_sha256`
    - `ajv_package_json_spec`
    - `ajv_lockfile_version`
    - `lockfile_version`
    - `errors`

## Stable failure codes

The checker should use stable machine-readable codes, not only prose:

| Code | Meaning |
|---|---|
| `missing-package-lock` | `package-lock.json` is absent. |
| `invalid-package-json` | `package.json` cannot be parsed. |
| `invalid-package-lock` | `package-lock.json` cannot be parsed. |
| `ajv-missing-dev-dependency` | Ajv is not declared in root `devDependencies`. |
| `ajv-runtime-dependency` | Ajv is declared in root `dependencies`. |
| `ajv-missing-root-lock-dev-dependency` | Lockfile root package does not list Ajv under `devDependencies`. |
| `ajv-missing-node-modules-entry` | Lockfile lacks `packages["node_modules/ajv"]`. |
| `ajv-missing-lockfile-version` | Ajv package entry lacks a version. |
| `ajv-not-dev-only` | Ajv package entry is not marked dev-only where expected. |
| `unexpected-internal-error` | Any unclassified implementation failure. |

## Exit semantics

- Exit `0`: all provenance checks pass and JSON report has `ok: true`.
- Exit `1`: expected governance failure with `ok: false` and stable error codes.
- Exit `2`: unexpected internal error with `unexpected-internal-error`.

The script should set `process.exitCode` instead of calling `process.exit()` directly, preserving cleaner testability and output flushing.

## Output shape draft

```json
{
  "ok": true,
  "gate": "lockfile-provenance",
  "package_json_sha256": "<sha256>",
  "package_lock_sha256": "<sha256>",
  "lockfile_version": 3,
  "ajv_package_json_spec": "^8.x.x",
  "ajv_lockfile_version": "8.x.x",
  "errors": []
}
```

## Test fixtures

The first tests should be dependency-free and use temporary directories with in-memory fixture files:

1. Missing lockfile fails with `missing-package-lock`.
2. Invalid JSON fails with parse-specific codes.
3. Ajv in `dependencies` fails with `ajv-runtime-dependency`.
4. Ajv absent from `devDependencies` fails with `ajv-missing-dev-dependency`.
5. Ajv absent from lockfile root fails with `ajv-missing-root-lock-dev-dependency`.
6. Ajv absent from `node_modules/ajv` fails with `ajv-missing-node-modules-entry`.
7. Valid minimal lockfile passes and emits matching SHA-256 values.

## Lane boundary

This checker belongs in a schema-governance lane, for example:

1. `npm ci`
2. `node tools/schema-governance/check-lockfile-provenance.mjs`
3. `node tools/schema-governance/generate-validators.mjs --check`

It must not be imported by `tools/agency-validation/run-fixture-parity.mjs`, and the agency runner must not import Ajv.

## Durable requirement added

Before MC generates standalone validators, the repository must prove dependency provenance with a committed lockfile and a read-only preflight that reports exact package/lock hashes and Ajv's dev-only placement.

## Next research question

How should MC implement the minimal `check-lockfile-provenance.mjs` and `check-lockfile-provenance.test.mjs` fixture harness so the provenance gate is executable immediately after the first npm-generated Ajv lockfile lands?
