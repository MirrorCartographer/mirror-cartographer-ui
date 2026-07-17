# Sovereign Host Bootstrap and Configuration Plane

This plane defines how the project reconstructs a trustworthy Linux host from blank or replaced hardware before application runtimes and higher control planes exist.

## Surviving design

1. Retain digest-pinned OS images, boot assets, and bootstrap configuration in project-controlled online and offline custody.
2. Generate a signed first-boot configuration from project-owned declarative source.
3. Verify the image and configuration digest before installation.
4. Apply storage, users, network policy, systemd units, and trust bootstrap non-interactively.
5. Do not embed long-lived secrets or execute arbitrary remote scripts.
6. Boot an immutable or transactional root with verified boot and an A/B rollback path.
7. Continuously compare live state with the admitted host manifest; security-control drift fails closed.
8. Rebuild clean hosts regularly on different hardware and retain signed evidence.

Fedora CoreOS Ignition plus pinned Butane is the initial mechanism because Ignition is explicitly first-boot provisioning rather than ongoing configuration management. Cloud-init remains a compatibility adapter for commodity images, but its provider datasource, instance identity, cache, staged script execution, and package-install features cannot be canonical authority.

## Authority boundary

Project-owned: OS and bootstrap manifests, admitted digests, signing policy, machine identity, disk/network/unit desired state, update rings, rollback rules, drift policy, evidence, and reconstruction procedure.

Replaceable: Fedora CoreOS, Ignition, Butane, cloud-init, systemd, bootloader, TPM, hypervisor, VM provider, bare-metal vendor, firmware updater, and configuration-management software.

Not physically owned: CPU and firmware fabrication, datacenter power, provider consoles, physical network transit, DNS registries, public CAs, and upstream hardware supply chains.

## Rejected directions

- Provider user-data as canonical desired state
- Mutable golden images without reproducible manifests
- Package installation from public mirrors during first boot
- Arbitrary curl-to-shell bootstrap
- Long-lived credentials embedded in images or metadata
- TPM sealing as the only recovery route
- In-place mutation with no known previous boot image
- One operator as the only person able to reimage or recover
- A cloud console or metadata service as the only bootstrap path

## Production evidence still required

The checked-in inventory is a fixture. Production admission must derive evidence from image rehashes, signature verification, measured boot records, disk and filesystem inspection, enabled systemd unit hashes, firewall state, package inventory, update/rollback logs, drift scans, hardware identity, and destructive clean-host rebuilds.
