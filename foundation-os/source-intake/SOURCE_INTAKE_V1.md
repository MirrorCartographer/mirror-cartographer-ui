# Foundation Source Intake v1

Foundation admits source through a quarantined intake gateway. Provider branches remain transport views, not canonical source identity.

Execution:

1. Fetch into a bare repository with hooks and checkout disabled.
2. Capture every offered reference and the object format.
3. Run strict Git integrity verification.
4. Create and verify a self-contained Git bundle.
5. Verify admission signatures locally against Foundation keys.
6. Leave submodules and external file content unresolved during admission.
7. Inspect paths and object sizes without executing repository code.
8. Require two Foundation approvers.
9. Emit an immutable manifest containing commit identity, reference tips, object format, bundle digest, policy digest, and inspection results.
10. Retain two bundle copies in separate failure domains before normalization begins.

Use Git for object storage, integrity checks, signatures, and bundle transport. Build and own the admission policy, quarantine wrapper, manifest schema, approval gate, and custody ledger.

Reject provider branches, provider verification badges, working-tree archives, mutable tags, and one online repository as canonical source authority.

Foundation owns admission, local verification, manifest identity, approval, custody, and export testing. Git, hardware, firmware, power, domain registration, and internet transit remain dependencies rather than Foundation intelligence or authority.

Verification laboratory:

Create a synthetic repository with ordinary history, additional references, an unsigned tag, a submodule declaration, an external-file pointer, and a large object. Run intake without checkout or network access. Accept only the policy-compliant variant. Export it as a bundle, remove the provider copy, restore from the bundle, and compare every admitted reference and manifest field.
