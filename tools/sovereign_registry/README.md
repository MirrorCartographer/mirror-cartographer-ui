# Sovereign artifact custody

This component makes a Foundation ledger plus content digests the release and restore authority. OCI registries remain replaceable transport and cache endpoints.

## Gates

- Publish only digest-addressed bytes.
- Write every release into two independently mounted custody roots.
- Record exact size, media type, copy location, and ledger digest.
- Promote only after `verify --minimum-good-copies 2` passes.
- Restore from any surviving verified copy and verify the restored bytes again.
- Reject mutable tag-only references as authority.
- Run registry garbage collection only after a custody-ledger reachability export and recovery-copy verification.

## Commands

```bash
python tools/sovereign_registry/custody.py store dist/release.tar custody.json /srv/custody-a /mnt/offsite-custody
python tools/sovereign_registry/custody.py verify custody.json --minimum-good-copies 2
python tools/sovereign_registry/custody.py restore custody.json restored/release.tar
python -m unittest tests/test_custody.py
```

## Ownership boundary

The project owns the ledger format, content identity, promotion gate, restore gate, and all custody bytes. A registry implementation, object store, disk vendor, colocation provider, DNS registrar, and transit provider remain replaceable resources. Physical sovereignty exists only for hardware, media, and network links physically controlled by the project.

## Surviving deployment direction

Run an OCI Distribution-compatible registry as a delivery interface over a separately backed custody layer. Keep canonical custody outside registry tag state. Export all blobs and ledgers to a second failure domain. Pin every deployment by digest. Retain an offline recovery copy.
