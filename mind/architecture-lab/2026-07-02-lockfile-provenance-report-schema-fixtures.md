# Lockfile provenance report schema + fixture contract

Date: 2026-07-02

## Architecture question

How should MC represent `lockfile-provenance-report.v1` as a tiny JSON Schema and fixture set so checker output can be contract-tested without requiring Ajv inside the checker itself?

## Researched sources

- JSON Schema Draft 2020-12 validation vocabulary: structural assertions such as `type`, `required`, `enum`, `const`, object properties, arrays, and regex `pattern` are sufficient for a small report contract.
- npm `package-lock.json`: the lockfile is the committed dependency tree artifact; the provenance report should treat its presence, lockfile version, and bytes as inputs, not something the checker edits.
- Node `crypto.createHash`: SHA-256 hashing should be performed by the checker with Node built-ins.
- Node `node:test`: fixture tests can be implemented with the built-in test runner, keeping the checker and fixture harness dependency-light.

## Decision

Create a separate report schema and fixtures, but do not make the checker import Ajv.

The checker should emit deterministic JSON. A separate schema-governance validation step may validate that emitted JSON against `mind/schemas/lockfile-provenance-report.v1.schema.json` using Ajv or a generated validator. The checker itself should remain read-only and dependency-free except for Node built-ins.

## Added contract files

- `mind/schemas/lockfile-provenance-report.v1.schema.json`
- `mind/fixtures/lockfile-provenance-report.v1/pass-dev-ajv.json`
- `mind/fixtures/lockfile-provenance-report.v1/fail-missing-lockfile.json`

## Report shape

The report is intentionally small:

- `report_version`: fixed contract identifier.
- `status`: `pass` or `fail`.
- `exit_code`: stable machine-readable process result.
- `package_json`: path, SHA-256, and whether Ajv appears in runtime or dev dependencies.
- `package_lock`: path, presence, SHA-256, and lockfile version.
- `ajv`: presence, version, and source classification.
- `checks`: ordered list of stable check codes with pass/fail statuses and human-readable messages.

## Useful concepts extracted

### Contract outside the checker

The checker should not become a JSON Schema validator. Its job is to read files, hash bytes, classify Ajv placement, and emit a report. Full schema validation belongs to the governance lane.

### Fixture polarity

The first fixture set must include at least one pass and one fail case. The fail case should represent the repo's current known precondition risk: validator generation must be blocked when `package-lock.json` is absent.

### Stable failure language

Machine routing should use `exit_code` and `checks[].code`; prose in `checks[].message` is diagnostic only.

### No timestamps

The report excludes timestamps. Freshness must be proven by file hashes, not wall-clock time.

## Implementation implications

The future `check-lockfile-provenance.mjs` should:

1. Read `package.json` and `package-lock.json` as bytes.
2. Compute SHA-256 hashes.
3. Parse JSON only after hashing.
4. Classify Ajv source as `devDependency`, `dependency`, `missing`, or `invalid`.
5. Emit the report shape above.
6. Exit with stable codes.
7. Avoid importing Ajv.

## Public-safety note

This artifact contains no private user material. It describes repository governance and validation boundaries only.

## Next research question

How should MC define the stable exit-code table and `checks[].code` namespace for `check-lockfile-provenance.mjs` so CI can route failures cleanly before standalone validator generation begins?
