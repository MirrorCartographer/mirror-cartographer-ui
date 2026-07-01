# Standalone Schema Validator Governance

Date: 2026-07-01
Status: architecture pattern
Scope: MC agency validation / fixture parity report governance
Privacy posture: public-safe; no personal/private run material included

## Architecture question

How should MC generate and version a standalone Draft 2020-12 validation module so schema changes automatically produce a deterministic validator artifact while keeping the runtime agency verification lane dependency-free?

## Research summary

The runner lane currently needs two properties that can conflict if collapsed into one mechanism:

1. The runtime path should stay dependency-free, deterministic, and narrow.
2. The schema contract should remain standards-aligned instead of being approximated by hand-coded partial checks.

Current JSON Schema Draft 2020-12 validation is not trivial to reimplement safely. Modern JSON Schema includes features such as dynamic references and annotation-dependent behavior, and formal work describes Modern JSON Schema validation as substantially more complex than classical JSON Schema. Ajv supports compile/build-time generation of standalone validation functions, with generated JS used later at runtime. Ajv also documents that standalone functions can reduce runtime startup cost, avoid dynamic code evaluation at runtime, and move schema compilation to build time.

## Useful concepts extracted

### 1. Generator lane is not runtime lane

The schema validator should be generated in a governance/build lane, not compiled inside `run-fixture-parity.mjs`.

Runtime lane:

- calls already-generated validator code,
- performs dependency-free structural invariant checks,
- emits stable exit code and report summary,
- does not install Ajv,
- does not compile schemas dynamically.

Governance lane:

- installs/pins Ajv as a dev dependency,
- compiles schema to a standalone validator module,
- writes deterministic generated output,
- fails when the generated file is stale relative to the schema.

### 2. Generated validators need provenance

A standalone validator file should be accompanied by metadata that makes drift obvious:

- source schema path,
- source schema content hash,
- generator package and version,
- generation command,
- generated timestamp policy,
- target module format,
- exported validator name,
- schema id or contract id.

Generated timestamps should be avoided in validator code where possible. If a timestamp is needed, put it in a separate metadata file only if the workflow can tolerate nondeterminism. Prefer content-addressed metadata.

### 3. Schema hash is the trust anchor

The generated artifact should not merely exist. It should prove it was generated from the exact schema currently committed.

Minimum metadata object:

```json
{
  "contract_id": "fixture-parity-failure-report.v1",
  "schema_path": "mind/schemas/fixture-parity-failure-report.v1.schema.json",
  "schema_sha256": "<sha256>",
  "validator_path": "tools/agency-validation/generated/validate-fixture-parity-failure-report.v1.mjs",
  "generator": "ajv",
  "generator_version": "<pinned version>",
  "module_format": "esm"
}
```

### 4. Staleness check belongs in CI

CI should include a governance check that regenerates the validator and fails if the working tree changes. This proves the committed generated artifact matches the committed schema.

Pattern:

1. install dev dependencies,
2. run `npm run generate:validators`,
3. run `git diff --exit-code -- tools/agency-validation/generated mind/generated-metadata`,
4. run dependency-free agency tests.

The dependency-free agency lane can remain separate, but governance CI should protect the generated validator contract.

### 5. Runtime imports only the generated module

`run-fixture-parity.mjs` should not import Ajv. It should import a local generated module behind a small adapter:

- `validateReport(report) -> { ok, errors }`
- validator error details are normalized into MC report evidence,
- schema failure remains a report-quality/internal-contract failure, not a fixture failure.

## Durable design pattern

### Pattern name

Generated Validator Boundary

### Intent

Keep runtime agency verification small and dependency-free while enforcing full schema compliance through a pinned, generated validator artifact.

### Forces

- Direct Ajv runtime import weakens the dependency-free lane.
- Hand-coded schema validation weakens standards compliance.
- Generated code can drift silently unless content-hash provenance is committed.
- CI workflows can hide contract failures if schema governance is mixed with app build failures.

### Decision

Create a separate validator-generation subsystem:

- `tools/agency-validation/generate-validators.mjs`
- `tools/agency-validation/generated/validate-fixture-parity-failure-report.v1.mjs`
- `mind/generated-metadata/fixture-parity-failure-report.v1.validator.json`

The generator compiles the Draft 2020-12 schema into an ESM standalone validator and writes a metadata file containing the schema hash and generator version. CI regenerates validators and fails if committed generated files are stale.

### Runtime rule

The runtime runner may import the generated validator, but it must not import Ajv or compile schemas.

### Governance rule

Every schema file that defines a report contract must have:

- a generated validator module,
- a generated metadata file,
- at least one valid fixture report sample,
- at least one invalid fixture report sample,
- a CI stale-generation check.

## Proposed implementation sequence

1. Add dev dependency pin for `ajv` or isolate it inside a governance-only package script.
2. Add `tools/agency-validation/generate-validators.mjs`.
3. Add `tools/agency-validation/generated/.gitkeep` if needed.
4. Generate `validate-fixture-parity-failure-report.v1.mjs` from `mind/schemas/fixture-parity-failure-report.v1.schema.json`.
5. Generate metadata with schema SHA-256 and Ajv version.
6. Add `npm run generate:validators`.
7. Add `npm run verify:validators` that regenerates and checks git diff.
8. Add CI lane or CI step scoped to `mind/schemas/**`, `tools/agency-validation/**`, and `package*.json`.
9. Update `run-fixture-parity.mjs` to call the generated validator through a tiny adapter.
10. Add tests proving Ajv is not imported by the runtime runner.

## Acceptance criteria

- Changing the schema without regenerating the validator fails governance CI.
- Running the runtime fixture parity shell does not require Ajv to be installed.
- The generated validator is deterministic under the pinned generator version.
- The metadata hash matches the current schema content.
- Runtime schema failures are classified as internal report-contract failures, not fixture mismatches.
- Public CLI flags remain unchanged.

## Open risk

Ajv standalone output may still reference Ajv runtime helpers unless bundled. The first implementation should explicitly test whether the generated ESM module can be imported in the intended dependency-free environment. If it cannot, the governance lane should add a bundling step or keep the generated validator out of the strict runtime path and use it only in governance CI.

## Next research question

How should MC implement `generate-validators.mjs` and the validator metadata hash check so the first generated validator artifact is deterministic, ESM-compatible, and testable without importing Ajv from `run-fixture-parity.mjs`?
