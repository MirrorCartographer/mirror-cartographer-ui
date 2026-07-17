# Sovereign release authority

This plane defines the project-owned decision that turns admitted source, build, test, security, and deployment evidence into a release.

## Surviving design

A release is an immutable manifest identified by SHA-256, signed by two distinct offline-controlled operators, and published through TUF metadata. The manifest binds normalized source, build graph, artifact, independent rebuild, tests, SBOM, SLSA provenance, vulnerability decision, and deployment policy. Deployment consumes the release-manifest digest, not a tag, provider release ID, registry state, or CI result.

TUF supplies threshold roles, root-key rotation, version continuity, consistent snapshots, expiration, rollback detection, freeze detection, and mix-and-match resistance. DSSE/in-toto supplies authenticated artifact-bound attestations. These are complementary: attestations describe evidence; TUF distributes the currently authorized release set.

## Authority boundary

Project-owned:

- release policy and sequence
- admission evidence requirements
- signer and threshold policy
- offline root and targets custody
- canonical release manifest and indexes
- rollback and emergency-decision rules
- publication copies and recovery evidence
- verification code

Replaceable mechanisms:

- TUF implementations
- DSSE and in-toto libraries
- HSMs and hardware tokens
- OCI registries, package registries, GitHub Releases, object stores, and mirrors
- CI systems and deployment runtimes

Not physically owned:

- processors, HSM fabrication, storage media supply chains
- DNS roots, domain registries and registrars
- public certificate authorities
- ISP networks, BGP, internet transit, datacenters, and power

## Adversarial conclusions

Rejected:

- a signature alone as release authorization
- a mutable tag or hosted release page as canonical state
- CI workers holding release keys
- the build platform promoting its own output
- one-person release or root authority
- transparency logs as the only proof path
- registry availability as a verification prerequisite
- rollback by moving a tag backward
- custom signed JSON without freshness and rollback defenses

A rollback is a new signed decision referencing a previously admitted artifact. Historical metadata is never rewritten.

## Production evidence still required

The JSON inventory is a design fixture. Production admission must derive evidence from signature verification, signer key IDs, TUF metadata versions and expiry, manifest and artifact rehashing, in-toto/SLSA verification, independent rebuild records, custody challenges, and an offline clean-host verification drill.

## Destructive laboratory

1. Generate three offline root keys and require two signatures.
2. Generate separate two-of-three targets/release keys.
3. Publish a digest-bound manifest and DSSE attestations.
4. Verify from a clean client seeded only with trusted root metadata.
5. Compromise timestamp and repository storage; prove arbitrary artifacts remain rejected.
6. Replay old metadata; prove rollback/freeze rejection.
7. Rotate root and targets keys through intermediate root versions.
8. Remove GitHub, public DNS, registry, and transparency-log access.
9. Restore metadata and artifacts from offline custody into a second TUF implementation.
10. Authorize rollback as a new signed release and verify deployment consumes its manifest digest.
