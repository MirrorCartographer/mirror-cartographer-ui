import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync(new URL("./policy.json", import.meta.url)));
const inventory = JSON.parse(fs.readFileSync(new URL("./inventory.json", import.meta.url)));

export function verify(p = policy, i = inventory) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const digest = value => /^sha256:[0-9a-f]{64}$/.test(value || "");

  check(p.authority === "project", "release authority must be project controlled");
  check(p.canonical_release_object === "signed immutable release manifest", "canonical release object must be a signed immutable manifest");
  check(p.artifact_identity?.algorithm === "sha256" && p.artifact_identity?.digest_only, "artifacts must be SHA-256 digest identified");
  check(p.artifact_identity?.mutable_tags_forbidden, "mutable tags must not authorize releases");
  check(p.admission?.fail_closed_on_missing_evidence, "missing evidence must fail closed");
  check(p.admission?.evidence_immutable, "admission evidence must be immutable");
  check(p.admission?.provenance_format?.includes("SLSA provenance v1"), "SLSA provenance v1 must be admitted");
  for (const field of p.admission?.requires || []) check(field in i && i[field] !== false && i[field] != null, `missing required evidence: ${field}`);
  check(i.independent_rebuild_match === true, "independent rebuilds must match");
  for (const field of ["artifact_digest","source_digest","policy_digest","test_result_digest","sbom_digest","provenance_digest","deployment_policy_digest"]) check(digest(i[field]), `invalid ${field}`);
  check(i.vulnerability_decision === "admit", "vulnerability decision must admit");
  check(p.signing?.format === "DSSE", "release attestations must use DSSE");
  check(p.signing?.release_threshold >= 2 && p.signing?.distinct_operators >= 2, "release requires two distinct signers");
  check(p.signing?.offline_root_threshold >= 2 && p.signing?.offline_root_keys >= 3, "offline root must use threshold custody");
  check(p.signing?.online_release_keys === 0, "release-authority keys must not be continuously online");
  check(p.signing?.release_keys_on_ci_workers === false, "CI workers must not hold release keys");
  check(p.signing?.key_rotation_test_days <= 90, "key rotation must be tested at least quarterly");
  check(p.metadata?.framework === "TUF", "release metadata must use TUF");
  check(p.metadata?.consistent_snapshots === true, "TUF consistent snapshots required");
  check(p.metadata?.root_threshold >= 2 && p.metadata?.targets_threshold >= 2, "root and targets require threshold signatures");
  check(p.metadata?.root_offline && p.metadata?.targets_offline, "root and targets keys must be offline");
  check(p.metadata?.timestamp_max_age_hours <= 24 && p.metadata?.snapshot_max_age_days <= 7, "freshness windows are too long");
  check(p.metadata?.rollback_protection && p.metadata?.freeze_protection, "rollback and freeze protection required");
  check(Number.isInteger(i.release_sequence) && i.release_sequence > 0, "release sequence must be monotonic integer");
  check(new Set(i.signer_keyids || []).size >= 2, "evidence must contain two distinct signer key IDs");
  check(["root","targets","snapshot","timestamp"].every(k => Number.isInteger(i.tuf_metadata_versions?.[k]) && i.tuf_metadata_versions[k] > 0), "TUF metadata versions missing");
  check(p.publication?.canonical_store_project_controlled, "canonical release custody must be project controlled");
  check(p.publication?.copies >= 3 && p.publication?.failure_domains >= 2, "release metadata requires three copies across two domains");
  check(p.publication?.immutable_copy && p.publication?.offline_copy, "immutable and offline copies required");
  check(p.publication?.hosted_release_page_authoritative === false && p.publication?.public_registry_authoritative === false, "hosted release pages and registries must not be authoritative");
  check(p.publication?.exportable, "release metadata must be exportable");
  check((i.copies || []).length >= 3 && new Set(i.copies.map(x => x.domain)).size >= 2, "custody copies are insufficient");
  check(i.copies.some(x => x.immutable) && i.copies.some(x => x.offline), "actual immutable and offline custody missing");
  check(p.promotion?.two_person && p.promotion?.separation_from_build && p.promotion?.separation_from_registry, "promotion authority must be separated and two-person");
  check(p.promotion?.deployment_consumes_manifest_digest, "deployment must consume the release manifest digest");
  check(p.promotion?.rollback_is_new_signed_decision, "rollback must be a new signed release decision");
  check(p.promotion?.emergency_bypass_audited, "emergency bypass must be audited");
  check(!p.continuity?.public_dns_required && !p.continuity?.public_ca_required && !p.continuity?.github_required, "verification cannot depend on DNS, public CA, or GitHub");
  check(p.continuity?.registry_required_for_verification === false, "verification cannot require a registry");
  check(p.continuity?.clean_host_restore_days <= 30 && p.continuity?.cross_implementation_verification, "clean-host cross-implementation verification required");
  check(i.restore?.clean_host && i.restore?.age_days <= 30 && i.restore?.cross_implementation, "restore evidence is stale or incomplete");
  check(i.restore?.without_dns && i.restore?.without_github && i.restore?.without_registry, "restore has hidden online dependencies");
  check(p.evidence?.signed && i.evidence_signed, "release evidence must be signed");

  return errors;
}

const errors = verify();
if (errors.length) {
  console.error(`REJECT ${errors.length} release invariants`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("ACCEPT 48 release invariants");
