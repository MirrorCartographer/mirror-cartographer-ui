# Validator Isolation Level Decision

Date: 2026-07-01
Status: Architecture decision note
Scope: MC agency-validation / schema-governance lane
Public-safety: contains only abstract architecture guidance; no private user material.

## Architecture question

Should MC target Level 1 isolation, where generated validators may still import Ajv runtime helpers, or Level 2 isolation, where validators are bundled into a fully Ajv-free ESM artifact?

## Decision

Target **Level 1 isolation first**.

Level 1 means:

- `run-fixture-parity.mjs` remains dependency-free and does not import Ajv.
- Ajv is used only in the schema-governance generation lane.
- Generated validator modules may import Ajv runtime helper modules if Ajv standalone generation emits those imports.
- CI proves that the runtime runner does not import Ajv, while governance tests prove the generated validator is ESM-importable and schema-fresh.

Treat **Level 2 isolation** as a later hardening milestone, not the default target.

Level 2 means:

- The generated standalone validator is bundled into an artifact that does not import Ajv runtime helpers.
- Bundling is performed in a governance/build step, likely with esbuild or equivalent.
- CI verifies there are no `from "ajv` or `require("ajv` references in the final generated artifact.

## Current-source findings

Ajv standalone generation is designed as a two-step process: compile/build-time generation of a JS validator file, then runtime use of that generated function. Ajv documents ESM output through `code: { source: true, esm: true }` and standalone export-name mapping when schema ids are not valid ESM export names.

Ajv also explicitly states that generated standalone validators still depend on code in Ajv's runtime folder. Ajv says completely isolated validation functions can be produced by running generated code through a bundler such as esbuild, but also says this is not needed for most use cases.

Esbuild supports bundling by inlining imported dependencies recursively, and its JavaScript API avoids shell argument ambiguity. That makes it a viable later Level 2 bundling step if the project needs fully Ajv-free validator artifacts.

Node's built-in `node:test` runner and `node:crypto` hashing are sufficient for Level 1 governance tests: import generated validator, validate pass/fail fixtures, hash schema bytes, hash validator bytes, and verify metadata consistency.

Sources reviewed:

- Ajv standalone validation code: https://ajv.js.org/standalone.html
- Ajv options / code generation settings: https://ajv.js.org/options.html
- Ajv JSON Schema reference: https://ajv.js.org/json-schema.html
- esbuild API bundling: https://esbuild.github.io/api/#bundle
- Node test runner: https://nodejs.org/api/test.html
- Node crypto hashing: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options

## Why Level 1 first

The MC architecture already separates three trust surfaces:

1. **Runtime runner:** deterministic, dependency-free, responsible for parser/report behavior and agency-lane evidence.
2. **Schema governance:** allowed to use Ajv to compile and test standards-compliant validators.
3. **Generated artifacts:** committed validator and metadata files that can be imported by CI checks without recompiling schemas.

Level 1 satisfies the actual immediate need: keep the runner clean while avoiding a partial in-house JSON Schema implementation. It also avoids premature bundling complexity.

Level 2 is stronger, but it adds a second compiler/bundler trust surface before MC has enough evidence that full Ajv-free validator artifacts are needed. Level 2 should be introduced only when one of these becomes true:

- the generated validator must run in an environment where `node_modules/ajv` is unavailable,
- supply-chain minimization requires no Ajv runtime imports in any validator execution path,
- browser/CSP deployment requires a single fully bundled validator artifact,
- validator artifacts are distributed outside the repository's governed dependency environment.

## Implementation requirement

Add an explicit isolation level to validator metadata.

Recommended metadata fields:

- `isolation_level`: enum of `level-1-ajv-runtime-helpers` or `level-2-bundled-ajv-free`
- `generator_package`: expected `ajv`
- `generator_version`: pinned version string or package-lock-derived version
- `schema_path`
- `schema_sha256`
- `validator_path`
- `validator_sha256`
- `generated_at_policy`: `not-authoritative`
- `runtime_import_policy`: for Level 1, `may-import-ajv-runtime-helpers`; for Level 2, `must-not-import-ajv`

## CI checks for Level 1

The first validator governance lane should prove:

1. `generate-validators.mjs --check` regenerates bytes and fails if the committed validator or metadata drift.
2. Generated validator can be imported as ESM.
3. Self-test fixtures include at least one expected pass and one expected fail.
4. Metadata hashes match schema and validator bytes.
5. `run-fixture-parity.mjs` has no Ajv import path.
6. The governance lane, not the runtime runner, owns Ajv dependency availability.

## CI checks reserved for Level 2

When Level 2 is introduced, add checks that:

1. run esbuild with bundling enabled against the generated validator entrypoint,
2. emit an ESM artifact into a generated validator directory,
3. verify the bundled artifact imports no `ajv` modules,
4. import the bundled artifact directly in `node:test`,
5. preserve the same pass/fail fixture behavior as the Level 1 validator,
6. record both unbundled and bundled hashes in metadata.

## Design pattern

Name: **Two-Level Validator Isolation**

Pattern:

- Keep operational runners dependency-free.
- Allow standards validators in governance generation.
- Commit generated artifacts with content hashes.
- Start with Ajv runtime-helper imports if they are confined to governance/test execution.
- Escalate to bundled Ajv-free artifacts only when the deployment surface requires it.

This prevents the project from confusing "the runner does not depend on Ajv" with "no generated artifact may ever import Ajv runtime helpers." Those are different boundaries and should be tested separately.

## Changed understanding

The previous question treated Level 1 and Level 2 as competing purity levels. Current research shows they are sequential maturity levels. Ajv standalone mode already provides the important boundary for MC: schemas are compiled during governance, not at runner execution time. Full Ajv-free isolation is possible, but it is a bundling hardening step, not the first implementation target.

## Durable next step

Implement Level 1 generation first:

- `tools/agency-validation/generate-validators.mjs`
- generated ESM validator for `mind/schemas/fixture-parity-failure-report.v1.schema.json`
- validator metadata with `isolation_level: "level-1-ajv-runtime-helpers"`
- self-test fixtures for valid and invalid reports
- CI check script that proves freshness and ESM importability

## Next architecture question

How should MC implement Level 1 `generate-validators.mjs` so it records `isolation_level`, pins Ajv/package-lock provenance, emits deterministic ESM validator and metadata files, and verifies pass/fail self-test fixtures without importing Ajv from the runtime runner?
