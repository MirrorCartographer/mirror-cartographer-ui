# Deterministic standalone validator artifact plan

Public-safe architecture note for Mirror Cartographer agency validation.

## Architecture question

How should MC implement `tools/agency-validation/generate-validators.mjs` so it emits the first Draft 2020-12 ESM validator, writes matching metadata, and fails deterministically when schema bytes, validator bytes, or self-test fixtures drift?

## Research basis

Current source behavior indicates:

- Ajv standalone generation is explicitly a two-step process: compile/generate validation code at build time, then import/use the generated validation function at runtime without initializing Ajv.
- Ajv standalone code can be emitted as ESM when `code.esm` is enabled, but ESM export names must be valid JavaScript identifiers; schemas with URL-like or fragment `$id` values need an explicit export-name mapping.
- Ajv standalone output may still import from Ajv runtime helpers unless bundled; therefore MC must distinguish “no Ajv initialization in the runner” from “fully bundled, no Ajv package import at all.”
- JSON Schema 2020-12 is too complex to reimplement casually; MC should treat standards validation as a generated governance artifact, not handwritten runtime logic.
- Node’s built-in crypto hashing and test runner are enough for deterministic byte checks and importability/self-test checks without invoking the full app build.

## Useful concepts extracted

### 1. Generator is a governance command, not runtime logic

`generate-validators.mjs` belongs in a schema-governance lane. It may depend on Ajv and build-time packages. `run-fixture-parity.mjs` must not import Ajv, compile schemas, or know about generator internals.

### 2. Hash all durable bytes, not timestamps

Metadata should pin:

- source schema path
- source schema SHA-256
- generated validator path
- generated validator SHA-256
- generator script path
- generator script SHA-256
- self-test fixture paths and SHA-256 values
- Ajv package version used to generate the artifact
- JSON Schema dialect
- exported validator name

Timestamps may exist only as human-readable context. They must not be the freshness authority.

### 3. Determinism check is regenerate-and-compare

The governance command should support two modes:

- `write`: generate validator and metadata.
- `check`: generate into memory or a temporary path, recompute expected metadata, and fail if committed bytes differ.

CI should use `check`; local maintenance can use `write`.

### 4. ESM importability is a contract

The self-test must dynamically import the generated validator module and assert:

- the expected named export exists,
- valid fixture passes,
- invalid fixture fails,
- validation errors are present on failure,
- Ajv is not imported by `run-fixture-parity.mjs`.

### 5. Runtime isolation has two levels

MC should explicitly name two isolation levels:

- **Level 1: no runtime compilation** — runner imports a generated validator module; Ajv is not initialized by the runner.
- **Level 2: no Ajv package import** — generated code is bundled or otherwise emitted without Ajv runtime imports.

The first implementation may target Level 1. If MC requires true dependency-free execution in a fresh environment, Level 2 becomes a separate build/bundle question.

## Proposed files

- `tools/agency-validation/generate-validators.mjs`
- `tools/agency-validation/generated/validate-fixture-parity-failure-report.v1.mjs`
- `tools/agency-validation/generated/validate-fixture-parity-failure-report.v1.metadata.json`
- `tools/agency-validation/generated/validate-fixture-parity-failure-report.v1.test.mjs`
- `tools/agency-validation/fixtures/valid-cli-parse-report.v1.json`
- `tools/agency-validation/fixtures/invalid-cli-parse-report.v1.json`

## Minimal generator contract

Inputs:

- schema path: `mind/schemas/fixture-parity-failure-report.v1.schema.json`
- validator export name: `validateFixtureParityFailureReportV1`
- output module path
- output metadata path
- mode: `write` or `check`

Outputs:

- deterministic ESM validator module
- metadata JSON with sorted keys and trailing newline
- non-zero exit on schema parse failure, generation failure, self-test failure, or drift

## Drift classes

| Drift class | Meaning | Required response |
|---|---|---|
| `schema-bytes-drift` | Schema content changed after validator generation | Regenerate validator and metadata |
| `validator-bytes-drift` | Generated code does not match current schema/generator | Regenerate and inspect diff |
| `metadata-drift` | Hash manifest does not match current durable bytes | Regenerate metadata |
| `fixture-drift` | Self-test fixtures changed without metadata update | Regenerate metadata or restore fixture |
| `importability-drift` | Generated module no longer imports as ESM | Fix generator/export mapping |
| `runtime-isolation-drift` | Runner imports Ajv or generator-only packages | Remove runtime coupling |

## Implementation requirements

1. Use Ajv 2020-compatible import path for Draft 2020-12 schemas.
2. Generate ESM with a stable named export.
3. Normalize output to UTF-8 with a final newline.
4. Compute SHA-256 from exact committed bytes.
5. Sort metadata keys deterministically.
6. Keep generator dependencies out of `run-fixture-parity.mjs`.
7. Keep self-test fixtures public-safe and synthetic.
8. Do not read private MC session content or personal material.

## Acceptance checks

- `node tools/agency-validation/generate-validators.mjs --mode=check` exits 0 when committed artifacts are fresh.
- The same command exits non-zero after editing the source schema without regenerating.
- The generated validator can be imported with ESM dynamic import.
- A valid synthetic report passes validation.
- An invalid synthetic report fails validation with errors.
- `run-fixture-parity.mjs` remains free of Ajv imports.
- Agency validation CI can run this governance check without invoking Vite or the full app build.

## Updated understanding

The deeper issue is not simply “generate a validator.” The real architectural question is how to preserve three membranes at once:

1. schema standards compliance,
2. runtime dependency minimalism,
3. deterministic evidence artifacts.

The safest design is a build-time governance lane that owns standards validation and byte-level freshness, while the runner lane remains narrow, deterministic, and agency-focused.

## Next research question

How should MC choose between Level 1 runtime isolation, where the generated validator may still import Ajv runtime helpers, and Level 2 full isolation, where the validator is bundled into a single Ajv-free ESM artifact?