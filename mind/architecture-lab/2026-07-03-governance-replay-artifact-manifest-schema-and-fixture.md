# Governance Replay Artifact Manifest Schema and Fixture

Date: 2026-07-03
Status: proposed
Public-safety class: public-safe architecture note

## Architecture question

How should MC define `governance.replay.artifact.manifest.v1.schema.json` and its first manifest fixture so replay artifact directories are self-describing, public-safe, digest-verifiable, and ingestible by future governance dashboards?

## Research basis

The manifest boundary should be narrow and verifiable:

- JSON Schema 2020-12 defines schemas as JSON documents with validation and annotation semantics, and identifies `application/schema+json` as the media type for JSON Schema documents.
- JSON Schema supports structured output formats, but MC should avoid storing raw validator internals in governance artifacts because replay artifacts must remain stable and public-safe.
- `actions/upload-artifact` exposes artifact metadata including `artifact-id`, `artifact-url`, and `artifact-digest`; the digest is SHA-256 over the uploaded artifact.
- GitHub artifact retention is explicitly configurable through `retention-days`, but repository, organization, or enterprise policy can cap retention.
- SPDX 3 treats an artifact as an identified digital object and models digest information through integrity-relevant metadata; MC should borrow the digest discipline without adopting a full SBOM model for this small replay directory.
- Recent GitHub Actions research reports that workflow complexity is associated with reliability and maintenance burden, which supports keeping manifest semantics in the producer tool rather than workflow YAML.
- Recent GitHub Actions security research reports that job-level permissions remain coarse, which supports keeping the manifest read-only and avoiding secret-bearing runtime captures.

## Updated understanding

The replay manifest is not just a file listing. It is the handshake between four systems:

1. The replay compiler, which creates deterministic JSON, Markdown, and annotation outputs.
2. The CI workflow, which uploads one artifact root and should not duplicate child-path logic.
3. A future governance dashboard, which needs to ingest replay status without scraping logs.
4. Human maintainers, who need enough file-level integrity context to diagnose broken artifacts.

That means `manifest.json` should be a small, typed, public-safe inventory with explicit file digests and declared ingestion entrypoints. It should not become a general-purpose SBOM, provenance graph, or log archive.

## Durable artifact added

### Schema

Path:

`mind/schemas/governance.replay.artifact.manifest.v1.schema.json`

The schema defines:

- `schema_version`: fixed to `governance.replay.artifact.manifest.v1`.
- `artifact_kind`: currently supports `governance.canonical-json.replay` and `governance.adr-index.replay`.
- `producer`: tool name, version, and command.
- `public_safety`: explicit public-safe classification and forbidden material policy.
- `root_policy`: declared root, resolved root, path separator, and child-path ownership.
- `source_result_sha256`: digest of `result.json`.
- `manifest_self_policy`: explicit policy for how `manifest.json` avoids unstable self-hashing.
- `files[]`: relative path, role, required flag, media type, byte count, SHA-256, and derivation inputs.
- `ingestion`: dashboard-safe entrypoints and status source.

### Fixture

Path:

`mind/fixtures/governance.replay.artifact.manifest.v1/pass-minimal-canonical-json-replay-manifest.json`

The fixture proves the minimal artifact set:

- `result.json`
- `summary.md`
- `annotations.ndjson`

It deliberately excludes `manifest.json` from `files[]` and records that as `manifest_self_policy.mode = excluded-from-files` to avoid unstable recursive self-hashing.

## Design decisions

### 1. Manifest is a directory contract, not a workflow contract

The workflow should know the artifact root and artifact name. The replay tool owns everything underneath the root.

### 2. Digest verification is file-level first

The manifest records SHA-256 per generated file. Archive-level artifact digest from GitHub can still be useful, but MC should not depend on it as the only integrity signal because dashboard ingestion needs stable file-level checks.

### 3. Public safety is schema-level, not just prose

The schema requires `public_safety.classification = abstracted-public-safe` and a concrete forbidden material policy. This prevents future artifact producers from treating privacy abstraction as optional documentation.

### 4. Manifest self-hashing must be explicit

A manifest that hashes itself is unstable unless special placeholder rules are defined. v1 chooses the simpler policy: exclude `manifest.json` from `files[]`, then record the exclusion explicitly.

### 5. The manifest is not an SBOM

SPDX-style thinking is useful for artifact identity and digest discipline, but adopting a full SBOM vocabulary here would increase implementation complexity without improving the immediate governance replay loop.

## Acceptance criteria

A correct next implementation should:

1. Generate `manifest.json` after `result.json`, `summary.md`, and `annotations.ndjson` exist.
2. Record SHA-256 digests using lowercase hex.
3. Reject absolute paths, parent-directory traversal, and backslash path separators.
4. Exclude environment variables, private source text, secrets, and raw validator dumps.
5. Allow dashboard ingestion to read only `manifest.json` and `result.json` to determine status.
6. Keep workflow YAML child-path-free except for the single artifact root.
7. Validate the manifest fixture against `governance.replay.artifact.manifest.v1.schema.json` before any dashboard ingestion work begins.

## Next research question

How should MC implement manifest generation inside `tools/replay-governance-canonical-json-fixtures.mjs` so `manifest.json` is created deterministically after replay outputs, verified against `governance.replay.artifact.manifest.v1.schema.json`, and used by GitHub Actions upload without duplicating file layout logic?
