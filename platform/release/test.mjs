import fs from "node:fs";
import { verify } from "./verify-release-contract.mjs";

const originalPolicy = JSON.parse(fs.readFileSync(new URL("./policy.json", import.meta.url)));
const originalInventory = JSON.parse(fs.readFileSync(new URL("./inventory.json", import.meta.url)));
const clone = value => structuredClone(value);

const cases = [
  ["reject-provider-authority", p => p.authority = "github"],
  ["reject-unsigned-manifest", p => p.canonical_release_object = "registry tag"],
  ["reject-tag-authority", p => p.artifact_identity.mutable_tags_forbidden = false],
  ["reject-missing-evidence", p => p.admission.fail_closed_on_missing_evidence = false],
  ["reject-nonimmutable-evidence", p => p.admission.evidence_immutable = false],
  ["reject-build-mismatch", (_, i) => i.independent_rebuild_match = false],
  ["reject-invalid-digest", (_, i) => i.artifact_digest = "latest"],
  ["reject-vulnerability-bypass", (_, i) => i.vulnerability_decision = "unknown"],
  ["reject-one-signer", p => p.signing.release_threshold = 1],
  ["reject-online-release-key", p => p.signing.online_release_keys = 1],
  ["reject-ci-release-key", p => p.signing.release_keys_on_ci_workers = true],
  ["reject-one-root-key", p => p.signing.offline_root_threshold = 1],
  ["reject-stale-rotation", p => p.signing.key_rotation_test_days = 365],
  ["reject-no-tuf", p => p.metadata.framework = "custom-json"],
  ["reject-no-consistent-snapshot", p => p.metadata.consistent_snapshots = false],
  ["reject-online-root", p => p.metadata.root_offline = false],
  ["reject-stale-timestamp", p => p.metadata.timestamp_max_age_hours = 168],
  ["reject-no-rollback-protection", p => p.metadata.rollback_protection = false],
  ["reject-two-copies", p => p.publication.copies = 2],
  ["reject-one-domain", p => p.publication.failure_domains = 1],
  ["reject-no-offline-copy", p => p.publication.offline_copy = false],
  ["reject-hosted-release-authority", p => p.publication.hosted_release_page_authoritative = true],
  ["reject-registry-authority", p => p.publication.public_registry_authoritative = true],
  ["reject-build-promotes-itself", p => p.promotion.separation_from_build = false],
  ["reject-unsigned-rollback", p => p.promotion.rollback_is_new_signed_decision = false],
  ["reject-dns-dependency", p => p.continuity.public_dns_required = true],
  ["reject-github-dependency", p => p.continuity.github_required = true],
  ["reject-registry-dependent-verification", p => p.continuity.registry_required_for_verification = true],
  ["reject-stale-restore", (_, i) => i.restore.age_days = 90],
  ["reject-one-evidence-signer", (_, i) => i.signer_keyids = ["operator-a"]],
  ["reject-unsigned-evidence", (_, i) => i.evidence_signed = false]
];

if (verify(clone(originalPolicy), clone(originalInventory)).length) throw new Error("baseline rejected");
console.log("PASS baseline");
for (const [name, mutate] of cases) {
  const p = clone(originalPolicy);
  const i = clone(originalInventory);
  mutate(p, i);
  if (!verify(p, i).length) throw new Error(`${name}: mutation was accepted`);
  console.log(`PASS ${name}`);
}
console.log("PASS adversarial release controls");
