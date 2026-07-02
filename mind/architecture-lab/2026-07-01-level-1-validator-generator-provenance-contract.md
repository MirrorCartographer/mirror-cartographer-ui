# Level 1 Validator Generator Provenance Contract

Date: 2026-07-01
Status: Architecture implementation contract
Scope: MC agency-validation / schema-governance lane
Public-safety: contains only abstract architecture guidance; no private user material.

## Architecture question

How should MC implement Level 1 `generate-validators.mjs` so it records `isolation_level`, pins Ajv/package-lock provenance, emits deterministic ESM validator and metadata files, and verifies pass/fail self-test fixtures without importing Ajv from the runtime runner?

## Decision

Implement the generator as a governed build tool, not as runtime validation logic.

The first implementation should be a **contract-first generator lane**:

1. `run-fixture-parity.mjs` remains Ajv-free and dependency-free.
2. `generate-validators.mjs` may import Ajv and Ajv standalone generation.
3. Ajv must be pinned through `package-lock.json` before executable generation is added.
4. Generated validator metadata must record the Ajv version and lockfile hash used to produce the validator.
5. Generated validator freshness must be checked by byte comparison and SHA-256 hashes, not by timestamps.
6. Self-test fixtures must prove both expected-pass and expected-fail behavior before the validator is trusted by CI.

## Current-source findings

Ajv standalone generation is explicitly designed as a two-step process: generate a JavaScript validation function at compile/build time, then use the generated function at runtime without initializing Ajv. For ESM output, Ajv requires `code: { source: true, esm: true }`; when schema identifiers are not valid ESM export names, a valid-name mapping must be supplied to standalone generation.

Ajv also documents an important Level 1 boundary: generated standalone validators can still depend on code from Ajv's runtime folder. Fully isolated validators require bundling, but that is a later Level 2 hardening step.

Node's `crypto.createHash()` is sufficient for deterministic SHA-256 hashing of schema bytes, validator bytes, metadata bytes, and lockfile bytes. The generator should hash exact UTF-8 bytes after normalizing output writing policy, not parsed JSON objects.

npm's `package-lock.json` describes the exact dependency tree that npm generated. For this architecture, the lockfile is not merely install metadata; it is provenance evidence for the Ajv version used to compile validator artifacts.

Sources reviewed:

- Ajv standalone validation code: https://ajv.js.org/standalone.html
- Ajv options / code generation settings: https://ajv.js.org/options.html
- Node crypto hashing: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
- npm package-lock.json: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/

## Repository observation

At this point, the repository does not expose `package-lock.json` on the default branch, and the visible `package.json` does not yet include Ajv. That means executable generator implementation should not be committed as if provenance exists.

The correct durable artifact for this run is therefore this implementation contract. It prevents a false implementation where a generated validator exists without a pinned generator dependency trail.

## Required files for the next implementation step

When Ajv is added, the implementation should introduce these files together:

- `tools/agency-validation/generate-validators.mjs`
- `tools/agency-validation/generated/fixture-parity-failure-report.v1.validator.mjs`
- `tools/agency-validation/generated/fixture-parity-failure-report.v1.validator.metadata.json`
- `tools/agency-validation/fixtures/fixture-parity-report.valid.json`
- `tools/agency-validation/fixtures/fixture-parity-report.invalid.json`
- `tools/agency-validation/generate-validators.test.mjs`

## Generator contract

`generate-validators.mjs` should support two modes:

- write mode: regenerate validator + metadata files.
- check mode: regenerate in memory, compare against committed files, and exit non-zero on drift.

Required behavior:

1. Read schema bytes from `mind/schemas/fixture-parity-failure-report.v1.schema.json`.
2. Read lockfile bytes from `package-lock.json`.
3. Resolve Ajv version from `package-lock.json` under `packages.node_modules/ajv.version`.
4. Compile with Ajv configured for standalone ESM output.
5. Emit a stable validator file with a generated-header warning and normalized trailing newline.
6. Import the emitted validator as ESM during the self-test phase.
7. Validate one known-good report fixture and one known-bad report fixture.
8. Write metadata only after validator generation and self-tests succeed.
9. In check mode, compare generated validator bytes and metadata bytes against committed files.
10. Fail deterministically if schema hash, validator hash, lockfile hash, Ajv version, or self-test behavior drift.

## Metadata contract

The generated metadata must include at minimum:

```json
{
  "schema_name": "fixture-parity-failure-report.v1",
  "schema_path": "mind/schemas/fixture-parity-failure-report.v1.schema.json",
  "schema_sha256": "<sha256>",
  "validator_path": "tools/agency-validation/generated/fixture-parity-failure-report.v1.validator.mjs",
  "validator_sha256": "<sha256>",
  "generator_path": "tools/agency-validation/generate-validators.mjs",
  "generator_package": "ajv",
  "generator_version": "<package-lock ajv version>",
  "package_lock_path": "package-lock.json",
  "package_lock_sha256": "<sha256>",
  "isolation_level": "level-1-ajv-runtime-helpers",
  "runtime_import_policy": "may-import-ajv-runtime-helpers",
  "runtime_runner_import_policy": "must-not-import-ajv",
  "generated_at_policy": "not-authoritative",
  "self_tests": {
    "valid_fixture": "tools/agency-validation/fixtures/fixture-parity-report.valid.json",
    "invalid_fixture": "tools/agency-validation/fixtures/fixture-parity-report.invalid.json",
    "expected_valid_result": true,
    "expected_invalid_result": false
  }
}
```

Do not use `generated_at` as an authority field. If present for human context, it must be explicitly marked non-authoritative. Freshness is determined by hashes and check-mode regeneration.

## Dependency rule

Ajv may appear in:

- `package.json` dev dependencies,
- `package-lock.json`,
- `tools/agency-validation/generate-validators.mjs`,
- generated validator imports under Level 1,
- generator tests.

Ajv must not appear in:

- `tools/agency-validation/run-fixture-parity.mjs`,
- parser-only modules,
- dependency-free runner tests,
- smoke execution paths used to prove runner behavior.

## Design pattern

Name: **Pinned Generator Provenance**

Pattern:

- Treat generated validators as evidence artifacts.
- Treat the generator dependency tree as part of the evidence.
- Pin provenance through `package-lock.json` and record its hash.
- Make freshness a deterministic byte comparison.
- Keep runtime runner trust separate from schema-governance trust.

## Changed understanding

The previous step correctly chose Level 1 isolation, but the deeper question is not only “how do we generate validators?” It is “what evidence proves this validator came from the schema and generator version we claim?”

The useful answer is provenance-first: do not add generated validation artifacts until Ajv and its resolved dependency tree are pinned. Otherwise the system would create a validator-shaped artifact with no durable proof trail.

## Next architecture question

How should MC add Ajv as a dev dependency and introduce the first `package-lock.json` governance rule so dependency provenance is created without contaminating the dependency-free agency runner lane?
