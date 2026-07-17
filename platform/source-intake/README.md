# Sovereign Source Intake and Reader Normalization

This plane turns untrusted source material into one canonical, content-addressed tree before any compiler, package manager, CI worker, or release process receives it.

## Authority boundary

The project owns the Reader policy, canonical-path rules, normalized-byte rules, manifest format, admission evidence, and raw/normalized custody. Git providers, archive formats, filesystems, checkout clients, and transfer services are replaceable intake mechanisms.

The Reader does not rewrite arbitrary source semantics. It normalizes only declared transport-level variation: path Unicode to NFC, text line endings to LF, and executable modes to an allowlisted canonical set. Binary bytes are preserved. Inputs that cannot be normalized without ambiguity are rejected.

## Threats addressed

- archive traversal and absolute paths
- symlink escapes and special files
- case-insensitive and Unicode-equivalent path collisions
- CRLF/LF drift
- timestamp, owner, group, xattr, and host-mode drift
- executable-bit injection
- UTF-8 BOM ambiguity
- secret material entering canonical source
- archive bombs and capacity exhaustion
- provider checkout metadata being mistaken for source identity
- loss of raw evidence after normalization

## Prototype

`reader.mjs` walks a directory without following symlinks, enforces limits, canonicalizes permitted metadata, normalizes declared text formats, preserves binary content, and emits a sorted SHA-256 manifest with a self-digest.

```sh
node platform/source-intake/verify-source-intake-contract.mjs
node platform/source-intake/test.mjs
node platform/source-intake/reader.mjs ./some-source-tree
```

## Production evidence still required

The checked-in inventory is a design fixture. Production admission must derive evidence from exact raw-bundle hashes, Reader binary digest, policy digest, normalization change log, two independent Reader executions, cross-filesystem results, secret-scan output, rejected-entry quarantine records, canonical bundle hash, custody challenges, and two operator signatures.

## Strongest surviving design

1. Acquire raw source into quarantine without execution.
2. Hash and retain the exact raw transport object.
3. Decode through a format-specific sandbox with path and expansion limits.
4. Run the project Reader.
5. Reject ambiguous paths, special files, symlinks, secrets, unsupported encodings, and policy violations.
6. Emit canonical bytes plus a sorted manifest.
7. Repeat on another clean host/filesystem.
8. Admit only byte-identical manifests.
9. Store raw evidence twice, including one offline copy.
10. Store normalized source three times across two failure domains.

## Rejected alternatives

- treating `git checkout` as canonical normalization
- preserving host timestamps, uid/gid, xattrs, or arbitrary permission bits
- following symlinks during intake
- lowercasing all paths
- applying NFKC to arbitrary source text
- normalizing binary files
- deleting raw intake after successful normalization
- accepting provider-generated archives without independent traversal checks
