#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const policy = JSON.parse(await readFile(new URL("./policy.json", import.meta.url)));
const inv = JSON.parse(await readFile(new URL("./inventory.json", import.meta.url)));
const checks = [];
const check = (name, ok) => {
  if (!ok) throw new Error(`REJECT ${name}`);
  checks.push(name);
};

check("project reader authority", policy.authority.canonical_reader === "project-owned" && !policy.authority.provider_checkout_authoritative && !inv.authority.provider_checkout_authoritative);
check("raw source retained", policy.authority.raw_source_retained && inv.source.raw_retained);
check("regular inputs only", policy.inputs.reject_symlinks && policy.inputs.reject_devices && policy.inputs.reject_sockets && policy.inputs.reject_fifos);
check("NFC paths", policy.paths.unicode_normalization === "NFC" && inv.normalization.unicode === "NFC");
check("path collision defense", policy.paths.case_collision_detection && inv.normalization.case_collisions === "reject");
check("path traversal defense", policy.paths.reject_absolute && policy.paths.reject_parent_traversal && policy.paths.reject_nul && policy.paths.reject_backslash);
check("bounded paths", policy.paths.max_path_bytes <= 1024);
check("UTF-8 text", policy.content.text_encoding === "UTF-8");
check("LF normalization", policy.content.text_line_endings === "LF" && inv.normalization.line_endings === "LF");
check("binary preservation", policy.content.binary_bytes_preserved);
check("BOM rejection", policy.content.reject_utf8_bom);
check("file-size bound", policy.content.max_file_bytes > 0 && policy.content.max_file_bytes <= 10485760);
check("canonical modes", policy.metadata.canonical_file_mode === "0644" && policy.metadata.canonical_executable_mode === "0755");
check("executable allowlist", policy.metadata.executable_allowlist.length > 0);
check("host metadata ignored", policy.metadata.ignore_uid_gid && policy.metadata.ignore_mtime && policy.metadata.ignore_ctime && policy.metadata.ignore_xattrs);
check("SHA-256 manifest", policy.manifest.algorithm === "SHA-256" && policy.manifest.self_digest);
check("deterministic ordering", policy.manifest.sorted_by === "utf8-path-bytes");
check("secret scan", policy.security.secret_scan_required);
check("archive limits", policy.security.archive_bomb_limits && policy.security.max_files <= 10000 && policy.security.max_total_bytes <= 104857600);
check("rejection quarantine", policy.security.quarantine_on_reject);
check("source provenance", policy.provenance.record_source_uri && policy.provenance.record_source_revision && /^[0-9a-f]{40}$/.test(inv.source.revision));
check("reader identity", policy.provenance.record_reader_digest && /^sha256:[0-9a-f]{64}$/.test(inv.reader.digest));
check("policy and change provenance", policy.provenance.record_policy_digest && policy.provenance.record_normalization_changes);
check("dual normalization", policy.reproducibility.two_reader_runs && inv.evidence.two_runs_identical);
check("cross-filesystem evidence", policy.reproducibility.cross_filesystem_test && inv.evidence.cross_filesystem);
check("byte-identical manifest", policy.reproducibility.byte_identical_manifest);
check("raw custody", policy.custody.raw_input_copies >= 2 && inv.custody.raw_copies >= 2 && policy.custody.offline_raw_copy && inv.custody.offline_raw);
check("normalized custody", policy.custody.normalized_copies >= 3 && inv.custody.normalized_copies >= 3);
check("failure domains", policy.custody.failure_domains >= 2 && new Set(inv.custody.failure_domains).size >= 2);
check("portable export", policy.custody.exportable_bundle && inv.custody.exportable_bundle);
check("two-person policy change", policy.operations.two_operators_for_policy_change);
check("signed admission", policy.operations.signed_admission_evidence && inv.evidence.signed);
check("fresh clean-host restore", inv.evidence.clean_host_restore_age_days <= policy.operations.clean_host_restore_days);
check("DNS-independent bootstrap", policy.operations.dns_independent_bootstrap);

console.log(`ACCEPT ${checks.length} source-intake invariants`);
