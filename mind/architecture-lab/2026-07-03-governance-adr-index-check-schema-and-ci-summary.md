# Governance ADR Index Check Schema and CI Summary Pattern

Date: 2026-07-03
Status: proposed
Public-safety level: public-safe abstraction only

## Architecture question

How should MC define `governance.adr.index.check.v1.schema.json` and a CI summary format so ADR index failures are machine-readable for tooling but also readable enough for a maintainer to fix without inspecting raw validator internals?

## Research basis

Current source patterns reviewed:

1. JSON Schema Draft 2020-12 output formatting
   - Source: https://json-schema.org/draft/2020-12/json-schema-core#section-12
   - Useful concept: validation output needs stable locations: keyword location, absolute keyword location, instance location, error/annotation, and nested results.

2. GitHub Actions workflow commands and job summaries
   - Source: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
   - Useful concept: CI should surface annotations for precise errors and write human-readable Markdown summaries through the job summary channel.

3. SARIF 2.1.0 result/log model
   - Source: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
   - Useful concept: analysis results should have stable rule identifiers, severity levels, messages, locations, and remediation metadata.

4. RFC 9457 Problem Details
   - Source: https://www.rfc-editor.org/rfc/rfc9457.html
   - Useful concept: failures benefit from a small typed envelope: type, title, detail, and instance. MC should adapt this pattern without binding the check format to HTTP.

5. Recent GitHub Actions reliability research
   - Source: https://arxiv.org/abs/2605.26825
   - Useful concept: complex workflows are associated with higher reliability and maintenance risk, so MC should keep the CI reporting contract simple, deterministic, and repair-oriented.

## Changed understanding

Before this step, ADR indexing had a compiler contract but no durable check-result contract. That left three failure modes:

- validators could emit raw implementation-specific errors;
- CI could show a readable summary that was not machine-verifiable;
- future tools could not reliably distinguish error identity, severity, location, and remediation.

The refined architecture separates three layers:

1. Source layer: ADR records remain the source material.
2. Machine layer: `governance.adr.index.check.v1` records stable check results.
3. Human layer: GitHub Actions job-summary Markdown is generated from the machine layer.

The human summary is not the source of truth. It is a rendered view of the check envelope.

## Design pattern

Name: dual-channel governance check reporting

Rule:

- Every ADR index validation run emits one JSON check envelope.
- Every check has a stable code using the `GOVERNANCE_ADR_INDEX/*` namespace.
- Every failing or warning check includes a maintainer-readable remediation string.
- Schema validator internals may be preserved only inside a normalized `validator_output` object.
- GitHub Actions annotations and Markdown summaries are generated from the same checks array.
- Public-safe abstraction is a first-class check, not an informal review note.

## Added durable artifacts

1. `mind/schemas/governance.adr.index.check.v1.schema.json`
   - Defines the machine-readable ADR index check envelope.
   - Includes status, summary, checks, locations, problem-details-inspired failure identity, and normalized validator output.

2. `mind/fixtures/governance.adr.index.check.v1/pass-empty-checks.json`
   - Provides a passing fixture for fixture replay.
   - Demonstrates generated Markdown summary as a view over the check envelope.

## Required stable check codes

Initial required codes:

- `GOVERNANCE_ADR_INDEX/ADR_RECORDS_DISCOVERED`
- `GOVERNANCE_ADR_INDEX/SCHEMA_VALIDATION_FAILED`
- `GOVERNANCE_ADR_INDEX/DUPLICATE_ADR_ID`
- `GOVERNANCE_ADR_INDEX/MISSING_EDGE_ENDPOINT`
- `GOVERNANCE_ADR_INDEX/INVALID_LIFECYCLE_TRANSITION`
- `GOVERNANCE_ADR_INDEX/PUBLIC_SAFE_ABSTRACTION`
- `GOVERNANCE_ADR_INDEX/UNSUPPORTED_COMPATIBILITY_BOUNDARY`
- `GOVERNANCE_ADR_INDEX/INDEX_EMITTED`

## CI summary contract

The generated job summary should include:

- overall status;
- ADR record count;
- total checks;
- error count;
- warning count;
- top failing check codes;
- affected file paths and JSON pointers when available;
- direct remediation text.

The summary must not include private notes, personal source material, secrets, or raw document excerpts. It may include abstract governance identifiers and repository paths.

## Implementation implications

The future `build-governance-adr-index.mjs` implementation should:

1. build the ADR index;
2. validate source records and generated index;
3. emit `governance.adr.index.check.v1`;
4. write CI annotations from failing checks;
5. write Markdown job summary from the same envelope;
6. exit nonzero only when at least one `severity: error` check has `status: fail`.

## Next question

How should MC define `build-governance-adr-index.mjs` fixture replay so passing, warning, and failing cases produce stable check envelopes, stable Markdown summaries, and stable exit behavior across Node versions and CI environments?
