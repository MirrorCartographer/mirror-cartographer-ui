# Foundation Release Authority v1

Status: implementation-ready control-plane specification.

## Capability selected

This run implements release authority: the project-controlled decision boundary that converts a verified build artifact into an authorized deployment candidate.

## Ownership rule

Foundation owns release policy, signing keys, approval records, release manifests, revocation state, and verification code. Registries, cloud hosts, HSM vendors, domain registrars, hardware vendors, and transit providers remain replaceable resources. None becomes the canonical release authority.

## Surviving design

Use a layered release envelope:

1. Address every deployable artifact by immutable SHA-256 digest.
2. Require a Foundation release manifest that binds artifact digest, source commit, build recipe digest, test evidence digests, target environment, sequence number, expiration, and rollback digest.
3. Sign the manifest with an offline-controlled Foundation root and delegated online release keys.
4. Store the signed manifest in at least two independently exportable locations: an OCI registry and an offline archive.
5. Verify locally before deployment. The hosting provider receives only a digest and a verified authorization decision.
6. Reject tag-only releases, mutable references, missing rollback targets, expired manifests, sequence rollback, unknown signers, insufficient threshold, and evidence mismatches.

## Cryptographic profile

- Production signing: Cosign with self-managed keys or hardware-backed PKCS#11 keys.
- Metadata hierarchy: TUF-style root, targets, snapshot, and timestamp role separation.
- Attestations: in-toto statement envelopes for build and test evidence.
- Artifact transport: OCI manifests and OCI-layout exports.
- Verification input: pinned public root metadata plus signed release envelope.

Cosign acts as a cryptographic implementation, not as authority. Foundation policy determines valid identities, thresholds, artifact digests, environments, and release sequence.

## Authority separation

- Root role: offline, threshold 2-of-3, rotates delegated keys, never runs in CI.
- Build attestor: signs build provenance only, cannot authorize release.
- Test attestor: signs test evidence only, cannot authorize release.
- Release role: threshold 2-of-2 for production and 1-of-1 for staging.
- Deploy worker: verifies and deploys; holds no signing key.
- Emergency rollback role: may authorize only a previously approved rollback digest.

## Release gate

A deployment proceeds only when all conditions return true:

- artifact reference contains an immutable digest;
- manifest schema and canonical digest validate;
- source commit and build recipe match recorded provenance;
- required test evidence exists and matches digests;
- release sequence exceeds the last accepted sequence;
- manifest has not expired;
- target environment matches the verifier invocation;
- signer set satisfies the environment threshold;
- signer keys remain unrevoked and within validity windows;
- rollback digest identifies a previously verified artifact;
- local policy digest equals the policy digest embedded in the manifest.

## Build-versus-buy decision

### Build the control plane

Foundation builds and owns:

- release manifest schema;
- canonicalization and digest rules;
- signer and threshold policy;
- release sequence ledger;
- verifier;
- revocation ledger;
- rollback authorization rules;
- export and restore procedure.

### Reuse replaceable implementations

Foundation reuses:

- Cosign for signatures and bundles;
- TUF libraries for metadata update safety;
- ORAS for OCI push, pull, backup, and restore;
- OpenSSL or PKCS#11 middleware for key access;
- any OCI-compatible registry as a transport replica.

Exit path: export OCI content to OCI-layout, export signed metadata and public roots, restore into another registry, and verify without contacting the former provider.

## Rejected alternatives

1. GitHub Releases as release authority. Rejected because account control and provider availability would control authorization and canonical evidence.
2. Vercel production deployment status as release authority. Rejected because hosting acceptance does not prove Foundation authorization.
3. Keyless-only Sigstore identity. Rejected as the sole production root because the OIDC issuer, transparency service, and external identity account become required at signing time. Retain as supplementary evidence.
4. One local private key. Rejected because theft, loss, or single-person absence destroys or compromises authority.
5. Tags as release identity. Rejected because tags are mutable aliases rather than immutable artifacts.

## Adversarial review before adoption

Attack: compromise the CI worker and sign a malicious artifact.

Result: CI holds build-attestation authority only. Production release requires independent release signatures and policy verification.

Attack: registry replaces a tagged image.

Result: verifier accepts only digest-addressed artifacts and checks the signed manifest digest.

Attack: release operator loses access.

Result: 2-of-3 offline root custody and a documented second-operator recovery drill prevent single-person dependency.

Attack: external signing service disappears.

Result: self-managed root and exported public metadata preserve verification. A hardware or KMS implementation remains replaceable.

Attack: old valid release is replayed.

Result: monotonic sequence ledger and expiration checks reject rollback unless the emergency rollback role explicitly authorizes a recorded digest.

## Verification commands

Run the executable policy prototype:

```sh
node foundation-os/release-authority/verify-release.mjs \
  foundation-os/release-authority/fixtures/valid-release.json \
  foundation-os/release-authority/policy.json \
  production
```

Run hostile fixtures:

```sh
node --test foundation-os/release-authority/verify-release.test.mjs
```

## Ownership boundary achieved

This design owns the software release decision, evidence model, trust roots, policy, and recovery path. It does not claim physical ownership of processors, storage media, power, network cables, domain registries, certificate roots, or internet transit. Commodity hardware and networks may fail or be replaced without changing release authority.

## Remaining dependencies

- cryptographic library correctness;
- secure physical custody for threshold root keys;
- at least two operators for production authorization and recovery;
- clocks accurate enough for expiration checks;
- independent storage for root metadata and release ledger;
- registry and network availability during distribution, but not during offline verification of exported artifacts.

## Cost and operational implications

- Three hardware signing tokens plus secure backup media create a small upfront cost.
- Two-person production approval increases release latency.
- Root rotation, revocation tests, token replacement, and restore drills create continuing operational work.
- Self-hosted signing infrastructure avoids per-signature vendor lock-in but transfers patching, auditing, and incident response to Foundation.

## Next falsifiable build step

Generate three test root keys, configure a 2-of-3 root threshold, sign one release envelope with two delegated production keys, export the artifact and signatures into OCI-layout, destroy the registry copy, restore into a second registry, and prove that the verifier accepts the restored digest while rejecting a tag mutation, revoked signer, expired manifest, and replayed sequence.