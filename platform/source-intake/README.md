# Sovereign Source Intake and Reader Normalization

This plane accepts untrusted source material, preserves its exact bytes as canonical evidence, and derives a deterministic Reader projection for indexing, comparison, semantic mapping, and tool consumption.

## Authority boundary

Raw source bytes are canonical. The Reader projection is derived and may not silently replace compiler input. This distinction prevents Unicode, line-ending, BOM, path, or metadata normalization from changing string literals, cryptographic fixtures, byte-sensitive parsers, generated files, signatures, or language semantics.

The project owns the raw-source catalog, origin records, path policy, Reader schema, normalization policy, collision rules, classification policy, evidence, and recovery. Git providers, archive formats, filesystems, checkout clients, Unicode libraries, and parser implementations are replaceable mechanisms.

## Prototype

`reader.mjs` now emits two identities:

- `raw_tree_digest`: exact source bytes plus canonical path and mode metadata.
- `reader_tree_digest`: the deterministic derived projection.

Every record retains `raw_digest`; text records add `projection_digest`, BOM and normalization-change evidence, and line mapping. Unknown binary files remain opaque and byte exact.

```sh
node platform/source-intake/verify-source-intake-contract.mjs
node platform/source-intake/test.mjs
node platform/source-intake/reader.mjs ./some-source-tree
```

## Normalization rules

Paths use NFC and `/`, but normalization collisions and case-fold collisions are rejected rather than merged. Absolute paths, parent traversal, backslashes, control characters, trailing dots/spaces, Windows reserved names, symlinks, hardlinks, and special files are rejected.

Declared text must be valid UTF-8. The Reader projection records and removes a UTF-8 BOM, converts CRLF or CR to LF, applies NFC, and never applies NFKC or invents a final newline. These transformations affect only the derived Reader representation.

## Adversarial findings

### Normalizing source in place

Rejected. Canonically equivalent Unicode can still occur inside byte-sensitive language constructs. Even line-ending conversion may change fixtures, generated outputs, or signed content.

### Using Git checkout as normalization authority

Rejected. Git line-ending behavior depends on attributes, configuration, platform, and working-tree policy. Git is an intake mechanism, not the Reader authority.

### Lowercasing paths

Rejected. It destroys distinctions on case-sensitive filesystems. The safe behavior is to preserve spelling and reject collisions that would alias on another supported platform.

### Applying NFKC

Rejected. Compatibility normalization erases distinctions and is unsafe for arbitrary source text.

### Trusting filename extensions

Rejected. Extensions are hints. Production intake must reconcile declared media type, filename, content validation, and sandboxed parser results. Ambiguous material is quarantined.

## Production evidence still required

The checked-in implementation handles regular directory trees. Production admission still requires:

- isolated archive extraction with traversal and decompression-ratio enforcement,
- MIME and declared-type reconciliation,
- sandboxed complex-document parsers,
- macro and embedded-object suppression,
- malware and secret-scan receipts,
- exact raw transport-object custody,
- two independent Reader executions,
- cross-filesystem and cross-runtime equivalence,
- signed clean-host reconstruction evidence.

## Ownership boundary

### Project-owned

Raw-source identity, Reader schema, normalization semantics, path portability rules, classification policy, parser admission, evidence, and recovery acceptance.

### Replaceable

Git, GitHub, archive libraries, MIME databases, Unicode implementations, malware scanners, secret scanners, object stores, VMs, and physical hosts.

### Not physically owned

Upstream source publication, domain registration, internet transit, processor and storage fabrication, firmware, facilities, power, public certificate authorities, and Unicode standard governance.
