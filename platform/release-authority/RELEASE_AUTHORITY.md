# Sovereign Release Authority

## Decision

Release authority is a project-held signing root applied to a digest-only release envelope. The envelope binds the immutable OCI image digest to the full source commit, SLSA v1 provenance digest, declared owned builder identity, and SBOM digest. Deployment is admitted only after both Cosign verification and semantic policy verification succeed.

The private root key is never committed, placed on a general CI worker, or stored only in a hosted KMS. Keep it encrypted on two offline media in separate failure domains. The repository contains only policy and verification logic. A replaceable online delegated key may be introduced later, but the offline root must sign its authorization and expiry.

## Workflow

1. Build on a project-controlled worker.
2. Push the image and resolve its `repository@sha256:digest` reference.
3. Produce SLSA v1 provenance with the allowed builder ID and an SBOM.
4. Create the envelope:

```bash
node platform/release-authority/create-release-envelope.mjs \
  registry.example/foundation/app@sha256:<64-hex> \
  <40-char-commit> provenance.json sbom.spdx.json release-envelope.json
```

5. Sign from the isolated release station:

```bash
COSIGN_KEY=/offline/release-root.key \
  platform/release-authority/sign-release.sh release-envelope.json release-envelope.sigstore.json
```

6. Copy the envelope, bundle, provenance and SBOM into the canonical registry and two independent backup locations.
7. Before deployment:

```bash
platform/release-authority/verify-release.sh \
  release-root.pub release-envelope.json release-envelope.sigstore.json provenance.json sbom.spdx.json
```

The deployment controller must consume the image reference printed by the successful verifier, never a tag supplied separately.

## Adversarial review before adoption

Rejected assumptions:

- A registry digest alone proves custody, not build or promotion authority.
- A mutable tag can be replaced without changing deployment configuration.
- A key stored only in CI lets worker compromise become release compromise.
- Keyless OIDC signing makes the external identity provider part of sole release authority.
- A signature stored only as an OCI referrer is lost with registry loss.
- A signature check without semantic checks can validate an authorized signature over the wrong builder, source, SBOM or provenance.

## Build-versus-buy

### Adopted: Cosign format and CLI with project-held keys

It supplies standard cryptographic bundles, supports local keys, hardware tokens and multiple KMS implementations, and can attach signatures using OCI 1.1 referrers. The project retains the key, bundle copies and verification policy.

### Rejected as sole authority: public keyless Sigstore

Useful as an additional public witness, but OIDC, Fulcio and transparency-log availability would become mandatory for release creation or historical verification. It may be layered on as a second signature.

### Deferred: self-hosted Fulcio and Rekor

Operating a CA and transparency log adds key ceremonies, database durability, witness design, patching and split-view risk. A single-project offline root provides a smaller auditable authority surface first.

### Deferred: Notation/Notary Project

OCI-native and viable, but switching formats before a destructive verification-and-restore exercise would not increase ownership. The envelope format isolates the policy from the signing implementation, preserving migration.

## Ownership boundary achieved

The project owns the release policy, private signing authority, public trust root, promotion decision, release metadata, verification code, and independent signature copies. No hosting provider, source forge, CI vendor, registry vendor or external identity provider is required to decide which digest is deployable.

This does not imply ownership of cryptographic hardware manufacture, CPU implementation, operating system, power, physical storage, network, domain registration, certificate authority or internet transit. Those remain dependencies with replacement and offline recovery paths.

## Post-artifact adversarial review

Remaining weaknesses:

- A stolen root key can authorize malicious releases until revocation reaches every verifier.
- A single signer can still become a procedural and coercion dependency.
- The current policy has one allowed builder ID and no threshold signatures.
- Cosign binary substitution can undermine signing or verification unless the binary itself is pinned and independently verified.
- The envelope records provenance and SBOM hashes but does not prove their factual completeness.
- Clock-free envelopes avoid timestamp trust but do not provide expiry or freshness; release sequence and revocation logs remain required.
- Backup copies can silently diverge unless restoration and hash comparison are exercised.

## Cost and operations

Software licensing cost is zero. Operational cost shifts to key ceremony, offline media custody, signer isolation, public-key distribution, revocation drills, Cosign upgrade verification, bundle backup, and deployment admission maintenance. Hardware-token or small offline-machine cost is modest; the larger cost is disciplined procedure and multi-person recovery.

## Next falsifiable build step

Create a clean-room test that generates a temporary key, constructs a fixture envelope, signs it, verifies it, then mutates each protected field and proves admission fails. Repeat after deleting the primary bundle and restoring it from each independent backup. The authority is not operational until the positive case and every mutation case produce the expected result without network access.
