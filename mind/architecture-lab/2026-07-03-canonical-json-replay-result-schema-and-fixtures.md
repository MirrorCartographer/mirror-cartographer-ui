# Canonical JSON replay result schema and fixtures

## Architecture question

How should MC define `governance.canonical-json.replay.result.v1.schema.json` and the first replay-result fixtures so canonical replay outcomes become first-class governance artifacts with stable status, stable check codes, and CI-safe generated summaries?

## Research basis

Sources reviewed during this architecture pass:

- JSON Schema Draft 2020-12 output formatting guidance.
- GitHub Actions workflow command documentation for annotations and job summaries.
- RFC 9457 Problem Details for structured, machine-readable problem descriptions.
- SARIF-style separation of machine rule identifiers, severity, message, and location was considered conceptually, but not adopted as the schema surface because MC only needs a compact governance replay envelope at this layer.

## Useful concepts extracted

### 1. Result envelope before Markdown

The replay tool should emit canonical JSON as the source of truth. Markdown summaries are generated views only. This keeps CI output readable without making Markdown the audit record.

### 2. Stable validation surface

JSON Schema output guidance separates an overall validity flag from structured error details. MC should use the same idea but adapt it to governance replay:

- `run.status`: aggregate state of the replay run.
- `run.exitCode`: stable process behavior.
- `summary`: counts for quick inspection.
- `fixtures`: per-fixture replay evidence.
- `checks`: normalized messages with stable codes.

### 3. Problem detail shape for fixability

RFC 9457 is useful because it separates a problem type, short title, occurrence-specific detail, and optional instance identity. MC should use a small embedded `problem` object for checks that require human action. This gives maintainers a stable repair target without exposing implementation internals.

### 4. Public-safe by construction

Canonical JSON fixtures must not contain personal/private material. Replay-result artifacts should explicitly declare the public-safety policy so later tooling can reject result files that accidentally include private material or conversation-derived content.

### 5. Exit behavior is part of the contract

Replay is not only a unit test. It is a governance compiler check. A fixture replay result must prove:

- expected output matched actual output;
- generated result JSON stayed schema-valid;
- generated Markdown summary stayed CI-safe;
- process exit behavior stayed stable.

## Durable changes added

### Schema

Added:

`mind/schemas/governance.canonical-json.replay.result.v1.schema.json`

Purpose:

Defines the canonical JSON replay result envelope for `tools/replay-governance-canonical-json-fixtures.mjs`.

Key fields:

- `schemaVersion`
- `kind`
- `tool`
- `run`
- `summary`
- `fixtures`
- `checks`
- `artifacts`
- `publicSafety`

Stable check-code namespace:

`GOVERNANCE_CANONICAL_JSON_REPLAY/*`

### Passing fixture

Added:

`mind/fixtures/governance.canonical-json.replay.result.v1/pass-single-fixture-replay-result.json`

Purpose:

Provides the first schema-valid passing replay-result fixture.

### Negative fixture requirement retained

Attempted but connector-blocked:

`mind/fixtures/governance.canonical-json.replay.result.v1/fail-hash-mismatch-replay-result.json`

The design requirement remains: v1 needs at least one schema-valid negative replay-result fixture representing a hash mismatch. It should use:

- `run.status = failed`
- `run.exitCode = 1`
- `checks[0].code = GOVERNANCE_CANONICAL_JSON_REPLAY/HASH_MISMATCH`
- `checks[0].level = error`
- a `problem` object documenting the repair path

## Requirements update

1. The replay tool must write JSON result artifacts before Markdown summaries.
2. Markdown summaries must be generated from the JSON result, never hand-authored as the source of truth.
3. Every check must use the `GOVERNANCE_CANONICAL_JSON_REPLAY/*` namespace.
4. Every replay result must include `run.exitCode` so CI behavior is auditable.
5. Every committed replay fixture must use fixed or omitted timestamps; runtime timestamps are allowed only in ephemeral generated CI output.
6. Every committed replay fixture must be public-safe and must not include personal, medical, account, identity, or conversation-derived material.
7. Hash mismatch should be represented as a governed replay failure, not raw assertion output.
8. Schema-invalid result envelopes should exit with code `2`; replay expectation failures should exit with code `1`; clean passes should exit with code `0`.

## Implementation pattern

Canonical fixture replay should follow this flow:

1. Load canonical JSON fixture corpus.
2. Canonicalize fixture input through `tools/lib/governance-canonical-json.mjs`.
3. Compute SHA-256 hex hash over canonical bytes.
4. Compare actual hash with expected fixture hash.
5. Emit `governance.canonical-json.replay.result.v1` JSON.
6. Validate the emitted result against the schema.
7. Generate Markdown summary from the validated JSON.
8. Emit GitHub Actions annotations from normalized checks.
9. Exit with the stable code declared in `run.exitCode`.

## What changed in understanding

Canonical replay is now a governance artifact producer, not a normal test runner. The important artifact is not merely whether tests pass; it is the durable explanation of what was replayed, what evidence was compared, what check codes were produced, and what CI behavior must remain stable.

## Next architecture question

How should MC implement `tools/replay-governance-canonical-json-fixtures.mjs` so it validates the replay-result envelope against `governance.canonical-json.replay.result.v1.schema.json`, generates CI-safe Markdown from JSON, emits GitHub annotations from normalized checks, and preserves stable exit behavior for pass, replay-failure, and schema-invalid cases?
