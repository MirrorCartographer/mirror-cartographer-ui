# Canonical Replay Artifact Directory Contract

Date: 2026-07-03
Status: proposed
Public-safety class: public-safe architecture note

## Architecture question

How should MC define the canonical replay artifact directory contract so the replay tool, GitHub Actions upload, job summaries, and future governance dashboard ingestion all consume the same stable file layout without duplicating path constants across scripts and workflows?

## Research basis

Current GitHub Actions behavior makes the directory contract part of the system boundary, not an incidental CI detail:

- Workflow artifacts are the supported mechanism for storing and sharing workflow output after a run, and `upload-artifact` can upload a single file, a directory, multiple paths, or wildcard-selected paths.
- Custom retention is configured at upload time with `retention-days`, bounded by repository, organization, or enterprise policy.
- `download-artifact` creates a directory per artifact when downloading all artifacts from a run.
- `actions/upload-artifact` exposes `artifact-id`, `artifact-url`, and `artifact-digest`; the digest is a SHA-256 digest of the uploaded artifact.
- GitHub job summaries are Markdown written to `GITHUB_STEP_SUMMARY`; they are good for human visibility but are generated views, not the source of truth.
- GitHub workflow commands can emit `notice`, `warning`, and `error` annotations that point at files and line positions.
- GitHub recommends configuring the minimum required `GITHUB_TOKEN` permissions at workflow or job level.
- 2026 GitHub Actions reliability research reports that workflow complexity correlates with higher failure and maintenance burden, so MC should keep the workflow thin and centralize semantics in the governance tool.
- 2026 GitHub Actions security research reports that job-level permissions are still coarse because every action in a job shares the same granted permissions; this supports isolating the replay job with read-only permissions and no unnecessary write-capable steps.

## Updated understanding

The artifact directory is a public contract between four surfaces:

1. `tools/replay-governance-canonical-json-fixtures.mjs` writes deterministic files.
2. GitHub Actions uploads those files without inventing additional layout semantics.
3. `GITHUB_STEP_SUMMARY` receives a rendered Markdown view generated from the JSON result.
4. Future dashboard ingestion reads the same stable files without scraping logs or summaries.

Therefore the path contract belongs in the governance tool library, not duplicated in the workflow YAML. The workflow should know only one root directory and one artifact name. Everything below the root must be owned by the replay tool.

## Design pattern: single-root replay artifact contract

Pattern name: `GOVERNANCE_REPLAY_ARTIFACT_ROOT`

Principle: every replay run writes one complete artifact tree under a single root, and every consumer treats that tree as immutable run output.

Recommended default root:

`artifacts/governance/canonical-json-replay/`

Required files:

- `result.json` — canonical replay-result envelope; source of truth.
- `summary.md` — CI-safe human summary generated only from `result.json`.
- `annotations.ndjson` — normalized annotation records, one JSON object per line.
- `manifest.json` — file inventory with path, byte count, SHA-256 digest, media type, and producer version.

Optional files:

- `fixtures/` — per-fixture replay detail JSON, only when detail output is enabled.
- `debug/` — local-only diagnostics; never required by CI and never used by dashboard ingestion.

Forbidden files:

- Raw private/personal source text.
- Environment dumps.
- Secret-bearing logs.
- Unbounded validator internals.
- Generated Markdown that is not reproducible from JSON.

## Stable layout

```text
artifacts/
  governance/
    canonical-json-replay/
      result.json
      summary.md
      annotations.ndjson
      manifest.json
      fixtures/
        <fixture-id>.json
```

The workflow should upload only the root directory. It should not upload individual files by scattered paths, because that duplicates the contract and makes future renames brittle.

## Environment contract

The replay tool should accept:

- `--artifact-root <path>` CLI argument.
- `GOVERNANCE_REPLAY_ARTIFACT_ROOT` environment variable.
- Built-in default `artifacts/governance/canonical-json-replay/`.

Precedence:

1. CLI argument.
2. Environment variable.
3. Built-in default.

The workflow should set the environment variable once and pass it through to the tool and upload step. The tool remains the owner of child paths.

## Manifest contract

`manifest.json` must include:

- `schema_version`: `governance.replay.artifact.manifest.v1`
- `artifact_kind`: `governance.canonical-json.replay`
- `generated_at_utc`
- `producer`: tool name and version
- `root_policy`: declared root, resolved root, path separator policy
- `files[]`: relative path, media type, byte count, sha256, required/optional flag
- `source_result_sha256`: SHA-256 of `result.json`
- `public_safety`: `abstracted-public-safe`

The manifest gives dashboard ingestion one lightweight entry point and gives CI a cheap integrity check before upload.

## Workflow implications

The canonical replay workflow should:

- Use `permissions: contents: read` unless a later artifact attestation workflow explicitly requires more.
- Run the replay tool.
- Append `summary.md` to `GITHUB_STEP_SUMMARY`.
- Emit annotations by reading `annotations.ndjson`.
- Upload the single artifact root with a stable artifact name such as `governance-canonical-json-replay`.
- Set `retention-days` explicitly, for example 14 days, while preserving the fact that higher-level repository/org policy may cap it.
- Avoid encoding child paths into YAML beyond the single artifact root.

## Acceptance criteria

A correct implementation satisfies all of these:

1. Running locally with no environment variables creates the default artifact tree.
2. Running with `GOVERNANCE_REPLAY_ARTIFACT_ROOT` writes the same child layout under the supplied root.
3. Running with `--artifact-root` overrides the environment variable.
4. `summary.md` can be regenerated byte-for-byte from `result.json` and renderer version.
5. `annotations.ndjson` contains only normalized public-safe records.
6. `manifest.json` lists every produced file except itself or lists itself with a stable self-hash policy explicitly documented.
7. GitHub Actions uploads the root directory as one artifact.
8. Future dashboard ingestion can read only `manifest.json` and `result.json` to decide status.

## Implementation note

The next durable artifact should define `governance.replay.artifact.manifest.v1.schema.json` and a pass fixture for a minimal canonical replay artifact manifest. This should be done before adding more workflow YAML, because the manifest is the contract that prevents the workflow from becoming the source of truth.

## Next research question

How should MC define `governance.replay.artifact.manifest.v1.schema.json` and its first manifest fixture so replay artifact directories are self-describing, public-safe, digest-verifiable, and ingestible by future governance dashboards?
