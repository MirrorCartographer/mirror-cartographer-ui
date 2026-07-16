# Cloudflare source-freshness adversarial review

Date: 2026-07-16
Branch: `cloudflare/adversarial-source-freshness-v2`
Target implementation head before this record: `b8e5c4ec9c4bddc38798228b772ca250bd85cefe`
Publication decision: **blocked**
Deployment evidence status: **absent / non-success**

## Checkpoint 1 — before architectural commitment

- **Claim or design tested:** A nonblank `sources[].accessed_at` value is sufficient provenance for a publishable Cloudflare research packet.
- **Challenge method:** Read the v1 publication boundary and construct malformed, stale, future-dated, and duplicated-source counterexamples without invoking deployments or production systems.
- **Evidence:** `publicationBoundary.v1.mjs` only required `accessed_at` to be a non-empty string and did not compare it with a verification time.
- **Failure or counterexample found:** `accessed_at: "recently"`, old observed evidence, future evidence, and duplicate locators could remain publishable.
- **Repair made:** Selected an additive v2 boundary with deterministic verification time, state-bounded freshness windows, future-clock tolerance, timestamp parsing, and normalized locator uniqueness.
- **Remaining uncertainty:** The 30-day observed and 180-day inferred/proposed windows are policy defaults, not provider guarantees; source content can change without URL change.
- **Rollback route:** Delete the isolated branch or revert commits from this cycle in reverse order.
- **Robustness increased:** Yes, at the design and source-contract level.
- **Next falsifiable step:** Prove malformed, stale, future-dated, and duplicate evidence fail closed in disposable Node fixtures.

## Checkpoint 2 — immediately after implementation

- **Claim or design tested:** The initial v2 verifier fails closed when callers provide an invalid verification clock.
- **Challenge method:** Add a fixture passing `nowMs: NaN` and inspect the time-resolution branch.
- **Evidence:** The initial implementation used `Number.isFinite(options.nowMs) ? options.nowMs : Date.now()`.
- **Failure or counterexample found:** Explicitly invalid verification time silently fell back to wall-clock time, making verification nondeterministic and fail-open.
- **Repair made:** Added `resolveVerificationTime`; explicitly supplied invalid `now` or `nowMs` now yields `verification_time_invalid`. Added v2 enforcement wrappers so authorization uses the freshness boundary before rendering.
- **Remaining uncertainty:** A valid timestamp proves recency metadata, not that the source was actually fetched, content-matched, immutable, or commit-matched.
- **Rollback route:** Revert `b8e5c4ec9c4bddc38798228b772ca250bd85cefe`, `9744e834d247967969d0d5319d46ab034c3a830c`, `050003b87b1b7d9a752509d2715ecb69dbc09217`, `190ace5c716bcbedda66b21587f9727ca07015ec`, `1c061bd1fa1dda0fc81d704c459b72278731b43d`, and `e59761357825c89ba0791e69c294a689a3a46070`, or delete the branch.
- **Robustness increased:** Yes; invalid verification context and stale/future evidence now have explicit fail-closed paths.
- **Next falsifiable step:** Execute the complete Cloudflare research suite from the exact branch head and retain stdout, stderr, exit code, Node version, and commit SHA.

## Checkpoint 3 — verification before declaring success

- **Claim or design tested:** The new freshness controls are part of the canonical Cloudflare research gate and are sufficient to declare publication-safe enforcement.
- **Challenge method:** Re-read the branch runner and verify required-suite inventory; distinguish committed source from executed evidence and deployment evidence.
- **Evidence:** `runCloudflareResearchTests.v1.mjs` now requires both v2 test suites, and package scripts already invoke the runner once in `test:local-gate` and `test:pages-preview`.
- **Failure or counterexample found:** No exact-commit runtime output exists. No authenticated Cloudflare project, quota, cancellation, branch mapping, output mapping, deployment identity, immutable URL, DNS, or rollback-execution evidence exists. Direct provider/workflow paths may bypass npm gates.
- **Repair made:** None beyond source-level gate inventory; promotion remains blocked rather than converting source presence into a false-positive deployment state.
- **Remaining uncertainty:** Runtime compatibility, canonical CI invocation, legitimate freshness-window exceptions, content digest binding, and provider-role reconciliation remain unproven.
- **Rollback route:** Delete the isolated branch or revert all listed cycle commits in reverse order.
- **Robustness increased:** Yes at the source-contract and gate-inventory levels; operational robustness is unproven.
- **Next falsifiable step:** Run `npm run test:cloudflare-research` at the exact branch head, retain commit-matched output, then prove a disposable stale observed packet is denied through the canonical publication command.

## Strongest surviving Cloudflare design

Cloudflare remains non-authoritative and publication remains fail-closed. Publication authorization should compose the existing privacy/claim boundary with deterministic source-freshness validation: parseable timestamps, bounded age by evidence state, future-clock rejection, normalized locator uniqueness, and denial before rendering. Runtime and deployment success require exact-commit evidence and cannot be inferred from committed source.

## Rejected alternatives

- Treating any nonblank timestamp as valid provenance.
- Using wall-clock fallback when an explicit verification time is malformed.
- Updating v1 destructively before inventorying consumers.
- Running a production deployment merely to discover configuration.
- Treating queued, canceled, skipped, superseded, rate-limited, stale, or commit-mismatched states as success.
- Declaring publication safe from source presence without exact-commit execution evidence.

## Unresolved risks

- Fresh timestamps are self-declared and not yet bound to retained response digests.
- Source URLs can serve changed content after verification.
- Freshness windows may need claim-specific or provider-specific policy profiles.
- Canonical workflow and direct deployment-command bypasses remain uninventoried.
- Provider authority among Cloudflare, Vercel, and GitHub Pages remains unreconciled.
- No authenticated deployment, quota, cancellation, branch/output mapping, hostname, DNS, or executed rollback evidence exists.

## Promotion decision

**Blocked.** Deployment evidence is absent and therefore non-success.
