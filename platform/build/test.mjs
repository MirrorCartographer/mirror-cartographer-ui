#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const inventory = path.join(here, "inventory.json");
const graph = path.join(here, "graph.json");
const verifier = path.join(here, "verify-build-contract.mjs");
const executor = path.join(here, "execute-build-graph.mjs");
const fixture = path.join(here, "fixture");
const base = JSON.parse(fs.readFileSync(inventory, "utf8"));

let result = spawnSync(process.execPath, [verifier, policy, inventory, graph], { encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  process.exit(1);
}
console.log("PASS baseline contract");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "foundation-build-test-"));
const evidenceA = path.join(temporary, "evidence-a.json");
const evidenceB = path.join(temporary, "evidence-b.json");
for (const output of [evidenceA, evidenceB]) {
  result = spawnSync(process.execPath, [executor, graph, fixture, output], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }
}
const a = JSON.parse(fs.readFileSync(evidenceA));
const b = JSON.parse(fs.readFileSync(evidenceB));
if (JSON.stringify(a.final_outputs) !== JSON.stringify(b.final_outputs)) throw new Error("independent outputs differ");
if (JSON.stringify(a.actions.map(x => x.action_key)) !== JSON.stringify(b.actions.map(x => x.action_key))) throw new Error("action keys differ");
console.log("PASS two empty-root deterministic builds");

const mutations = [
  ["reject-provider-authority", x => x.authority.provider_authoritative = true],
  ["reject-ci-authority", x => x.authority.ci_authoritative = true],
  ["reject-fixed-adapter", x => x.authority.adapter_replaceable = false],
  ["reject-unpinned-inputs", x => x.graph.inputs_digest_pinned = false],
  ["reject-unpinned-toolchain", x => x.graph.toolchains_digest_pinned = false],
  ["reject-undeclared-outputs", x => x.graph.undeclared_outputs_rejected = false],
  ["reject-no-env-allowlist", x => x.graph.environment_allowlist = []],
  ["reject-local-timezone", x => x.graph.timezone = "America/New_York"],
  ["reject-no-epoch", x => delete x.graph.source_date_epoch],
  ["reject-network", x => x.execution.network_disabled = false],
  ["reject-no-sandbox", x => x.execution.sandbox = false],
  ["reject-sandbox-fallback", x => x.execution.sandbox_fallback = true],
  ["reject-host-filesystem", x => x.execution.host_filesystem_access = true],
  ["reject-host-tools", x => x.execution.host_toolchain_access = true],
  ["reject-rootful-worker", x => x.execution.rootless = false],
  ["reject-persistent-worker", x => x.execution.ephemeral = false],
  ["reject-cross-trust-reuse", x => x.execution.cross_trust_reuse = true],
  ["reject-no-resource-limit", x => x.execution.memory_mb = 0],
  ["reject-build-fetch", x => x.dependencies.fetch_separate = false],
  ["reject-nonfixed-fetch", x => x.dependencies.fixed_output_only = false],
  ["reject-no-lockfile", x => x.dependencies.lockfile = false],
  ["reject-public-network", x => x.dependencies.public_network = true],
  ["reject-one-builder", x => x.reproducibility.builders = x.reproducibility.builders.slice(0, 1)],
  ["reject-one-domain", x => x.reproducibility.builders.forEach(builder => builder.domain = "site-a")],
  ["reject-warm-cache-evidence", x => x.reproducibility.builders[0].empty_cache = false],
  ["reject-cache-hit-evidence", x => x.reproducibility.cache_hit_used_as_evidence = true],
  ["reject-no-byte-equality", x => x.reproducibility.byte_identical = false],
  ["reject-no-quarantine", x => x.reproducibility.quarantine_on_mismatch = false],
  ["reject-unsigned-cache", x => x.cache.signature_verified = false],
  ["reject-shared-cache-write", x => x.cache.read_write_separated = false],
  ["reject-cache-canonical", x => x.cache.canonical_artifact_store = true],
  ["reject-no-poison-test", x => x.cache.poisoning_test = false],
  ["reject-wrong-provenance", x => x.provenance.predicate_type = "custom"],
  ["reject-in-action-signing", x => x.provenance.signed_outside_action = false],
  ["reject-incomplete-materials", x => x.provenance.complete_materials = false],
  ["reject-github-required", x => x.continuity.github_required = true],
  ["reject-hosted-ci-required", x => x.continuity.hosted_ci_required = true],
  ["reject-cache-required", x => x.continuity.original_cache_required = true],
  ["reject-no-offline-toolchain", x => x.continuity.offline_toolchain_bundle = false],
  ["reject-stale-clean-host", x => x.continuity.last_clean_host_rebuild_age_days = 31],
  ["reject-one-operator", x => x.continuity.trained_operators = 1],
  ["reject-unsigned-evidence", x => x.evidence.signed = false]
];

for (const [name, mutate] of mutations) {
  const changed = structuredClone(base);
  mutate(changed);
  const file = path.join(temporary, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(changed));
  result = spawnSync(process.execPath, [verifier, policy, file, graph], { encoding: "utf8" });
  if (result.status === 0) throw new Error(`${name} accepted`);
  console.log(`PASS ${name}`);
}

const tampered = JSON.parse(fs.readFileSync(graph, "utf8"));
tampered.actions[0].inputs[0].digest = "sha256:" + "0".repeat(64);
const tamperedPath = path.join(temporary, "tampered-graph.json");
fs.writeFileSync(tamperedPath, JSON.stringify(tampered));
result = spawnSync(process.execPath, [executor, tamperedPath, fixture, path.join(temporary, "tampered-evidence.json")], { encoding: "utf8" });
if (result.status === 0) throw new Error("tampered input accepted");
console.log("PASS reject-tampered-input");

fs.rmSync(temporary, { recursive: true, force: true });
console.log("PASS adversarial build controls");
