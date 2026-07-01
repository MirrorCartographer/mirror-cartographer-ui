# Standalone Validator Generation Hash Plan

## Architecture question

How should MC implement `generate-validators.mjs` and validator metadata hash checks so the first generated validator artifact is deterministic, ESM-compatible, and testable without importing Ajv from `run-fixture-parity.mjs`?

## Public-safe context

The fixture parity runner is becoming an agency-validation lane: it produces machine-readable reports about staged evidence gates. The runtime runner should stay dependency-free and should not compile JSON Schema dynamically. Full JSON Schema compliance belongs in a governance generation lane that can use Ajv at build time and commit the generated validator artifact.

## Current-source research distilled

### Ajv standalone generation

Ajv supports generating standalone validation functions from JSON Schemas at compile/build time. The generated JS module can then be imported at runtime without initializing Ajv. This supports faster startup, smaller runtime dependency surfaces, and environments where dynamic compilation is undesirable.

Relevant concepts:

- Generation is a two-step process: compile schemas during build/governance, then import generated validators during runtime or verification.
- `code.source: true` is required for standalone generation.
- ESM output is supported with `code.esm: true`.
- Multi-schema ESM generation needs stable export-name mapping when `$id` values are not valid ESM export identifiers.
- Ajv standalone output can still reference Ajv runtime helpers unless bundled or otherwise isolated; MC should not assume “standalone” always means zero runtime dependency unless this is tested.

### JSON Schema Draft 2020-12 boundary

The failure-report schema uses modern JSON Schema semantics. MC should not hand-roll Draft 2020-12 validation inside the dependency-free runner. The runner may enforce local invariants, but standards compliance should be delegated to generated validators created from a real schema implementation.

### Deterministic artifact hashing

Node’s `crypto.createHash('sha256')` is the correct primitive for content hashing. For MC, the metadata hash should be computed over canonical inputs, not incidental local paths or wall-clock time.

Hash inputs should include:

1. The exact schema file content bytes after normalized LF line endings.
2. The generator script version string.
3. The validator target name, for example `fixtureParityFailureReportV1`.
4. The Ajv package version and generation options.
5. The output module format, for example `esm`.

Hash inputs should exclude:

- Local absolute paths.
- Generation timestamps.
- Hostname, username, or environment-specific information.
- Private/personal context.

## Decision

Implement validator governance as a committed generated-artifact lane:

```text
schema JSON
  -> generate-validators.mjs
  -> generated ESM validator module
  -> generated metadata JSON
  -> validator self-test
  -> dependency-free runtime imports only generated validator, never Ajv
```

The runtime agency runner remains clean:

```text
run-fixture-parity.mjs
  -> parser
  -> staged gates
  -> report object
  -> local structural invariants
  -> optional generated validator import in verification lane
```

Ajv belongs only to the governance/generation script and dev dependency path. The runtime runner must not import Ajv directly.

## Proposed repository additions

### 1. Generator script

Path:

`tools/agency-validation/generate-validators.mjs`

Responsibilities:

- Read `mind/schemas/fixture-parity-failure-report.v1.schema.json`.
- Instantiate the Ajv 2020-12 implementation, not the default older-draft constructor.
- Use strict generation options.
- Generate ESM standalone validation code.
- Write the generated validator to:

`tools/agency-validation/generated/fixture-parity-failure-report.v1.validator.mjs`

- Write metadata to:

`tools/agency-validation/generated/fixture-parity-failure-report.v1.validator.meta.json`

- Sort metadata keys before writing.
- Normalize all generated text to LF.
- Compute SHA-256 hashes for schema input, validator output, and metadata payload.

### 2. Metadata contract

Path:

`mind/requirements/standalone-validator-metadata.v1.schema.json`

Minimum fields:

- `artifact_kind`: must be `standalone-schema-validator`.
- `schema_path`.
- `schema_sha256`.
- `validator_path`.
- `validator_sha256`.
- `generator_path`.
- `generator_version`.
- `validator_export_name`.
- `schema_dialect`.
- `module_format`.
- `ajv_version`.
- `generation_options`.

Explicitly forbidden:

- `generated_at`.
- absolute filesystem paths.
- usernames.
- hostnames.
- private profile data.

### 3. Validator self-test

Path:

`tools/agency-validation/generated-validator.test.mjs`

Test cases:

- Imports the generated ESM validator successfully.
- Validates one known-good minimal `cli-parse` failure report.
- Rejects one known-bad report missing a required root field.
- Confirms `validate.errors` is populated on failure.
- Confirms the metadata hash matches the current generated validator bytes.
- Confirms the generated validator file does not contain a direct `import Ajv from` statement.

## Durable design rules

1. **Generated validators are governance artifacts, not source-of-truth schemas.** The schema remains the authority.
2. **Hash metadata proves freshness, not correctness.** Correctness still comes from schema self-tests and validator behavior.
3. **Runtime dependency-free means no direct Ajv import from the runner.** A generated validator may be imported only from a verification step that is explicitly allowed to validate schema compliance.
4. **Determinism must be tested.** Running the generator twice from the same inputs should produce identical validator and metadata bytes.
5. **No private context in artifacts.** Reports, schemas, validators, and metadata must remain public-safe.

## Implementation sequence

1. Add `ajv` as a dev dependency only.
2. Add `tools/agency-validation/generate-validators.mjs`.
3. Add generated validator and metadata artifacts.
4. Add `tools/agency-validation/generated-validator.test.mjs`.
5. Add package scripts:
   - `generate:agency-validators`
   - `verify:agency-validators`
6. Keep `verify:agency` dependency-free unless explicitly running the governance validator lane.

## Acceptance criteria

- `run-fixture-parity.mjs` does not import Ajv.
- Generated validator is ESM-compatible.
- Metadata uses SHA-256 over deterministic inputs.
- No timestamps, hostnames, usernames, or absolute paths appear in metadata.
- Validator self-test proves pass/fail behavior.
- Regenerating from unchanged inputs produces no diff.

## Next research question

How should MC design the minimal `standalone-validator-metadata.v1.schema.json` and generated-validator self-test fixtures so validator freshness, ESM importability, and Ajv-runtime isolation are proven in CI without coupling to the full app build?
