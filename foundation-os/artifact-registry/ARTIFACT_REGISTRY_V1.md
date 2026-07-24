# Foundation Artifact Registry V1

## Decision

Run an OCI-compatible registry as a replaceable distribution index. Keep artifact acceptance, release authority, canonical inventory, and recovery archives under Foundation control.

## Execution chain

accepted build digest -> OCI manifest and referrer graph -> Foundation inventory ledger -> distribution registry replicas -> digest-only deployment -> portable OCI-layout export -> destructive restore verification

## Enforced rules

1. Address every deployable artifact by digest. Treat tags as navigation labels only.
2. Store images, packages, signatures, SBOMs, attestations, and evidence as an OCI graph.
3. Keep a canonical inventory outside every registry implementation.
4. Export every accepted release with all tags and referrers into an OCI-layout archive.
5. Keep three copies across two failure domains and one independent write boundary.
6. Separate artifact acceptance and release authorization from registry credentials.
7. Issue short-lived scoped push and pull credentials.
8. Run garbage collection only after a dry run, a read-only transition, a verified export, and a post-collection graph audit.
9. Restore periodically into a different OCI-compatible registry and compare every manifest, blob, and referrer digest.
10. Require a second operator to complete a blank-host restoration.

## Build-versus-buy

Use CNCF Distribution as the first minimal registry implementation. It implements OCI-compatible content-addressed distribution and keeps storage backends replaceable. Use ORAS for graph-aware export, archive, transfer, and restore. Add Harbor only when measured requirements justify its larger control plane, including replication administration, scanning integration, quotas, audit interfaces, or project management. Do not build a custom registry protocol or storage format.

## Adversarial findings

Content addressing detects changed bytes but does not prevent authorized deletion. Keep recovery copies outside routine registry write authority.

Mutable tags can be moved. Deploy only immutable digests and record tag history separately.

Registry garbage collection can delete blobs involved in concurrent writes. Stop writes or place the registry in read-only mode, perform a dry run, verify a current archive, then collect and audit the graph.

A copied primary image without its referrers loses signatures, SBOMs, attestations, and other evidence. Export and restore the complete referrer graph.

A registry database, UI, or provider account can disappear. Reconstruct distribution from OCI-layout archives plus the Foundation inventory ledger.

## Rejected alternatives

- provider registry as canonical artifact custody
- mutable tags as deployment identity
- registry administrator as release authority
- replication as the only backup
- object-storage durability as deletion resistance
- online garbage collection without a verified safety gate
- custom artifact protocol
- Harbor before its operating burden is justified by measured needs

## Ownership boundary

Foundation owns artifact acceptance, digest policy, inventory, release linkage, credential scope, retention, export, restore acceptance, and provider replacement. Foundation does not own processor fabrication, storage firmware, electricity, internet transit, domain registration, public trust roots, or upstream OCI implementations.

## Verification laboratory

Push a synthetic image with a signature, SBOM, and attestation. Record every digest. Export all tags and referrers. Delete the original registry and storage. Restore into a different implementation. Compare the complete graph. Move a tag and verify deployment remains pinned. Inject an orphan blob, run garbage-collection dry run, enter read-only mode, collect, and verify accepted graphs remain complete. Rebuild the registry on a blank host through a second operator.

The capability passes only when the restored registry reproduces every accepted digest and referrer without the original implementation or storage provider.
