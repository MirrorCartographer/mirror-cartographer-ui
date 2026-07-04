# Minimal expected-fixture verifier contract

Date: 2026-07-04
Status: Architecture contract
Public-safety level: public-safe; no private user material, no secrets, no unsafe fixture payloads

## Architecture question

How should MC implement the first minimal `tools/compare-governance-expected-fixtures.mjs` verifier so it compares byte digests, emits normalized expected-fixture checks, writes deterministic result and summary files, and fails safely before update mode exists?

## Researched current sources

1. GitHub Actions workflow commands: annotations, masking, and per-step Markdown summaries.
   - https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
2. GitHub Actions variables: `GITHUB_ACTIONS` is always set to `true` inside a GitHub Actions workflow.
   - https://docs.github.com/en/actions/reference/workflows-and-actions/variables
3. Git diff exit behavior: `--exit-code` returns `1` when differences exist and `0` when there are no differences.
   - https://git-scm.com/docs/git-diff
4. Node.js crypto hashing: `crypto.createHash('sha256')` is the stable native mechanism for byte digests.
   - https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
5. Node.js process exit behavior: prefer `process.exitCode` and graceful exit over forced `process.exit()` so stdout/stderr and summary writes are not truncated.
   - https://nodejs.org/api/process.html#processexitcode
6. Node.js filesystem promises: use explicit read/write/mkdir operations to avoid shell-dependent behavior.
   - https://nodejs.org/api/fs.html
7. GitHub Actions reliability research, 2026: larger, more complex workflows correlate with higher failure and maintenance risk, so the verifier should be small, local, and dependency-light.
   - https://arxiv.org/abs/2605.26825

## Useful concepts extracted

### 1. The verifier is a public API guard, not a generator

Expected fixtures represent the public replay contract. The first tool must only answer:

- Did every actual output byte-match its expected fixture?
- Which file pairs matched, differed, or were missing?
- Which normalized checks should downstream summaries, annotations, and dashboards consume?

It must not update expected fixtures in this first version.

### 2. Compare bytes before semantics

For this layer, semantic JSON equality is insufficient. The point is byte custody: newline, key order, Markdown escaping, path normalization, and digest stability are part of the contract. Therefore each pair should be compared as raw bytes and represented by SHA-256 digests.

### 3. Distinguish comparison result from process failure

A fixture mismatch is a domain failure, not a tool crash. The result envelope should still be written deterministically when mismatches occur. The process should exit nonzero only after writing `result.json` and `summary.md`.

### 4. Missing update mode is a deliberate safety feature

The first verifier should reject every update flag, bless flag, or environment variable that implies fixture mutation. In CI, mutation must be impossible because no mutation path exists. Later update mode can be added as a separate command after the verify contract is proven.

### 5. GitHub output should be derived, not authoritative

The canonical records are deterministic files:

- `result.json`
- `summary.md`

GitHub annotations and `GITHUB_STEP_SUMMARY` are projections of normalized checks. They should not introduce new wording, state, or severity not already present in the result envelope.

## Proposed durable contract

### Tool name

`tools/compare-governance-expected-fixtures.mjs`

### Inputs

Required:

- `--actual-dir <path>`: directory containing freshly generated verifier outputs.
- `--expected-dir <path>`: directory containing checked-in expected outputs.
- `--out-dir <path>`: directory where comparison result artifacts are written.

Optional:

- `--suite <id>`: stable suite identifier; default `governance.expected-fixtures.v1`.
- `--emit-github-annotations`: allowed only as a projection of normalized checks.

Forbidden in v1:

- `--update`
- `--bless`
- `--write-expected`
- `UPDATE_EXPECTED`
- `BLESS_FIXTURES`
- any mode that writes into `--expected-dir`

### Minimal output files

`result.json` fields:

- `schemaVersion`: `governance.expectedFixtureComparison.v1`
- `suite`: stable suite id
- `state`: one of `passed`, `failed`, `error`
- `processOutcome`: one of `success`, `domain_failure`, `tool_error`
- `actualDir`: normalized POSIX relative path
- `expectedDir`: normalized POSIX relative path
- `outDir`: normalized POSIX relative path
- `pairs`: array of comparison pair objects
- `checks`: normalized governance replay check objects
- `summary`: stable counts only

Pair object fields:

- `id`: stable relative path id
- `actualPath`: normalized POSIX relative path
- `expectedPath`: normalized POSIX relative path
- `state`: `matched`, `different`, `missing_actual`, `missing_expected`, or `error`
- `actualSha256`: digest or null
- `expectedSha256`: digest or null
- `actualBytes`: byte count or null
- `expectedBytes`: byte count or null

`summary.md` sections:

1. Title
2. Suite
3. State
4. Counts
5. Check table
6. Pair table
7. Public-safe remediation text

No timestamps, hostnames, absolute paths, usernames, runner names, or machine-specific data.

### Check-code additions

Add expected-fixture codes to `tools/lib/governance-replay-checks.mjs` after the current registry model is confirmed:

- `expected_fixture.matched`
- `expected_fixture.different`
- `expected_fixture.missing_actual`
- `expected_fixture.missing_expected`
- `expected_fixture.update_mode_rejected`
- `expected_fixture.result_written`
- `expected_fixture.summary_written`
- `expected_fixture.tool_error`

Severity mapping:

- `matched`: info
- `different`: error
- `missing_actual`: error
- `missing_expected`: error
- `update_mode_rejected`: error
- `result_written`: info
- `summary_written`: info
- `tool_error`: error

State mapping:

- all pairs matched: `passed` and process outcome `success`
- any missing/different pair: `failed` and process outcome `domain_failure`
- unreadable directories, invalid args, or write failures: `error` and process outcome `tool_error`
- forbidden update flag detected: `error` and process outcome `tool_error`

### Exit behavior

Use `process.exitCode`, not forced `process.exit()`.

- `0`: all expected pairs match and result/summary were written
- `1`: deterministic comparison completed but mismatches or missing files exist
- `2`: tool contract error, invalid args, forbidden update mode, unreadable input, or failed output write

The tool should write all possible public-safe diagnostics before assigning the final exit code.

### CI safety rule

Inside GitHub Actions, `process.env.GITHUB_ACTIONS === 'true'` should be treated as a signal that mutation is forbidden. Since v1 has no mutation path, this is primarily used to emit a clearer `expected_fixture.update_mode_rejected` check if someone tries to pass a forbidden update flag.

### Determinism rules

- Sort pair ids lexicographically.
- Normalize paths to POSIX separators.
- Compare file bytes directly.
- Compute SHA-256 from raw bytes.
- Serialize JSON with the existing stable output helper.
- Render Markdown from normalized checks, not from ad hoc strings.
- Never include wall-clock time.
- Never include absolute host paths.
- Never include raw fixture content in the result envelope.

## Implementation plan

Phase 1: verify-only skeleton

- Parse arguments.
- Reject forbidden update/bless flags and environment variables.
- Walk actual and expected directories.
- Create a sorted union of relative file ids.
- Compare raw bytes for each pair.
- Emit normalized pair records and checks.
- Write deterministic `result.json` and `summary.md`.
- Set exitCode 0, 1, or 2.

Phase 2: fixture pair manifest

- Add optional checked-in manifest listing required expected files.
- Fail if an expected fixture is not listed or a listed fixture is absent.
- This prevents accidental broad directory comparisons.

Phase 3: GitHub projection

- Append `summary.md` to `GITHUB_STEP_SUMMARY` when present.
- Emit annotations only from normalized check objects.
- Mask any accidentally discovered sensitive-looking value before output.

Phase 4: future update command, separate from verifier

- Add a separate script such as `tools/update-governance-expected-fixtures.mjs` only after v1 verifier proves stable.
- Require local-only execution, clean git tree, explicit suite, explicit file list, and human review.
- Do not add update mode to the verifier command.

## What changed in MC understanding

MC should not treat expected fixture comparison as a normal test helper. It is a custody boundary for public replay contracts. The safer architecture is two-command separation:

- verifier: easy to run everywhere, impossible to mutate fixtures
- updater: separate, later, explicit, local-only, and review-heavy

This reduces CI injection risk, keeps the first implementation small, and makes fixture drift a visible governance event rather than a silent regeneration side effect.

## Next architecture question

How should MC define the optional expected-fixture pair manifest so the verifier compares only intentional public API files, rejects unlisted generated outputs, and still allows new fixture additions through a clear reviewable path?
