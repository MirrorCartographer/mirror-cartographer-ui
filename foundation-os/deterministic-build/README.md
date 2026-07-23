# Deterministic Build Execution V1

Foundation accepts an artifact only after two clean builders in independent failure domains reproduce the same bytes from the same immutable source, dependency lock, toolchain digest, and build instructions.

Execution gate:

1. Resolve an immutable source commit.
2. Resolve dependencies and toolchains through content-addressed locks.
3. Disable network access during the build.
4. Set SOURCE_DATE_EPOCH, UTC, and C.UTF-8.
5. Normalize paths, timestamps, ownership, permissions, archive ordering, and randomness.
6. Build on two clean workers in separate failure domains.
7. Hash every declared output with SHA-256.
8. Accept only exact digest agreement.
9. Run diffoscope on disagreement and quarantine both outputs.
10. Bind source, worker image, toolchain, derivation, and output digest into signed provenance.
11. Move accepted artifacts into Foundation artifact custody.
12. Sign accepted digests only in the separate release-authority stage.

Use Nix as the first derivation and sandbox implementation. Pin Nix and nixpkgs revisions. Mirror all required inputs. Preserve OCI worker images and a plain build manifest as a second execution representation.

Reject hosted build output as canonical. Treat hosted builders only as optional independent witnesses behind the same acceptance gate.

Reject a custom build engine at this stage. It creates parser, sandbox, dependency, cache, scheduler, worker, provenance, and compatibility burdens before a measured gap exists.

Adversarial findings:

- Two matching builds do not defeat an identically poisoned toolchain.
- Reproducibility does not prove source safety.
- Binary caches can bypass execution; clean verification stores disable untrusted substitutes.
- Signing introduces nondeterminism; keep signing outside the reproducible build.
- Nix sandboxing does not eliminate kernel, CPU, firmware, or upstream compiler dependencies.
- Production exceptions expire and require two-party approval.

Verification laboratory:

Build the application on two clean workers while varying hostname, username, workspace path, timezone, locale, CPU count, worker image patch level, and filesystem enumeration order. Require byte-for-byte equality. Preserve mismatched outputs and diffoscope reports. Destroy both workers, replace the executor implementation, rebuild from Foundation mirrors with public networking disabled, and require the same digest.

Ownership boundary:

Foundation owns source admission, build policy, dependency locks, accepted derivations, worker selection, reproducibility gates, provenance requirements, artifact acceptance, and canonical custody. Foundation does not own CPU fabrication, firmware, electricity, internet transit, domain registration, upstream compiler maintenance, kernel implementation, or cryptographic primitives.

Next falsifiable step:

Create a Nix flake for the current Vite application, pin Node and npm inputs, execute two clean builds, vary the declared environment, compare recursive output digests, and commit either the first accepted reproducibility receipt or the first mismatch report.
