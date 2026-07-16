# Independent platform adversarial review — immutable static release packager

## Scope

A provider-neutral, zero-runtime-dependency packaging boundary for locally built static assets. No deployment, automation, schedule, credential, DNS, shared state, or production system was modified.

## Checkpoint 1 — before architectural commitment

- **Claim/design tested:** Owning the source and running `vite build` locally is sufficient to make the website build process independent of provider build-rate limits.
- **Challenge method:** Inspected canonical package scripts and traced the identity boundary between local build output and provider-specific deployment commands.
- **Evidence:** `package.json` exposes local Vite builds, but release identity and deployment evidence are primarily modeled around Vercel and provider-specific gates.
- **Failure/counterexample:** A local `dist/` directory is mutable and unversioned. Rebuilding or copying over it can destroy the exact artifact associated with a commit. Provider independence without immutable release packaging produces ambiguous rollback and weak provenance.
- **Repair/refinement:** Introduce an additive provider-neutral packager that copies static output into `releases/<exact-commit>/` and retains a SHA-256 manifest.
- **Remaining uncertainty:** The repository still depends on Vite/npm to compile the application; this change owns packaging and release identity, not the entire compiler toolchain.
- **Evidence quality:** Direct source inspection; no runtime execution.
- **Rollback route:** Delete the isolated branch. No canonical branch or deployment was modified.
- **Robustness increased:** Yes, at the design-contract level.
- **Evidence required before publication:** Exact-commit test output and a successful package of a real local build.
- **Next falsifiable step:** Run the negative-control suite from the exact branch head.

## Checkpoint 2 — immediately after implementation

- **Claim/design tested:** The packager safely produces immutable, commit-bound releases and fails closed for invalid inputs.
- **Challenge method:** Added disposable Node fixtures for branch labels, abbreviated commits, empty output, invalid timestamps, and overwrite attempts.
- **Evidence:** `tools/independent-platform/package-static-release.test.mjs` encodes five positive and negative controls. The implementation rejects non-40-character lowercase SHAs, empty inputs, invalid timestamps, and an existing target directory; it removes staging and partial target directories on failure.
- **Failure/counterexample:** An isolated implementation could remain dormant and silently drift because no canonical local gate invoked its tests.
- **Repair/refinement:** Added `test:owned-release` and bound it as the first discrete step of `test:local-gate`. Added `build:owned-release` as a provider-neutral packaging entrypoint.
- **Remaining uncertainty:** Runtime passage is not established. The local gate binding itself is not yet protected by a composition negative control. Concurrent processes targeting the same commit have not been stress-tested.
- **Evidence quality:** Commit-retained implementation and fixture source; no executed stdout/stderr.
- **Rollback route:** Revert the package binding commit, fixture commit, and implementation commit in reverse order, or delete the isolated branch.
- **Robustness increased:** Yes, at source-contract and canonical-local-gate levels.
- **Evidence required before publication:** Node version, exact SHA, stdout, stderr, and exit code for `npm run test:owned-release` and `npm run test:local-gate`.
- **Next falsifiable step:** Run two simultaneous packaging attempts for the same commit in a disposable directory and require exactly one success.

## Checkpoint 3 — verification before declaring success

- **Claim/design tested:** The branch constitutes an operational replacement for provider build infrastructure.
- **Challenge method:** Distinguished committed source identity from runtime execution, deployment, and operational ownership.
- **Evidence:** Exact source commits exist on an isolated branch; no deployment was triggered and no runtime evidence was retained.
- **Failure/counterexample:** The artifact packager does not yet host releases, route traffic, build React without npm/Vite, manage secrets, or prove rollback under real storage failure. Therefore it is not yet a complete owned platform.
- **Repair/refinement:** Constrain the claim: this is the first owned release boundary, not the full platform. Keep promotion blocked.
- **Remaining uncertainty:** Filesystem durability, concurrent publication atomicity, garbage collection policy, signed manifests, storage replication, and serving-layer design remain unresolved.
- **Evidence quality:** Commit-matched source inspection only; operational evidence absent.
- **Rollback route:** Delete the isolated branch; no production rollback is necessary.
- **Robustness increased:** Yes, but only for immutable packaging and provenance.
- **Evidence required before publication:** Exact-commit runtime tests, real-build packaging evidence, retained manifest, read-back digest verification, and a demonstrated rollback to an older release directory.
- **Next falsifiable step:** Package a real `dist/` at the exact commit, independently recompute every digest, then serve that immutable directory locally and verify the application smoke test against it.

## Strongest surviving design

Compile locally, then package static output into an immutable directory named by the exact source commit. Retain a deterministic per-file SHA-256 manifest. Keep provider deployment adapters downstream and optional so Cloudflare, GitHub Pages, Vercel, a VPS, or local hosting can consume the same owned release artifact.

## Rejected alternatives

- Treating mutable `dist/` as a release artifact.
- Using a branch name or abbreviated SHA as release identity.
- Overwriting a prior release for the same commit.
- Coupling packaging to a specific provider CLI.
- Declaring platform independence from committed source without runtime or hosting evidence.

## Unresolved risks

- Runtime tests have not been executed at the branch head.
- Vite/npm remain compilation dependencies.
- No owned artifact store or serving runtime exists yet.
- Concurrent writer behavior needs explicit validation.
- Manifest authenticity is not cryptographically signed.
- No retention, replication, or disaster-recovery policy exists.

## Publication decision

Blocked. The branch is a reversible research implementation. It must not be promoted until exact-commit runtime evidence and real-build digest verification exist.
