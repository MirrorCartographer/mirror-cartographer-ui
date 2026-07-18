#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath, graphPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath || !graphPath) {
  console.error("usage: verify-build-contract.mjs POLICY INVENTORY GRAPH");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const g = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(p.authority.project_owned_graph_schema && i.authority.project_owned, "project must own build graph");
check(!p.authority.provider_build_definition_authoritative && !i.authority.provider_authoritative, "provider cannot be build authority");
check(!p.authority.ci_workflow_authoritative && !i.authority.ci_authoritative, "CI workflow cannot be canonical build definition");
check(i.authority.adapter_replaceable && i.authority.action_keys_exportable, "executor adapter and action keys must be portable");
check(digest(g.source_digest) && digest(g.policy_digest), "source and policy digests required");
check(i.graph.acyclic, "acyclic graph required");
check(i.graph.inputs_digest_pinned && i.graph.toolchains_digest_pinned, "inputs and toolchains must be digest pinned");
check(i.graph.outputs_declared && i.graph.undeclared_outputs_rejected, "outputs must be declared and enforced");
check(Array.isArray(i.graph.environment_allowlist) && i.graph.environment_allowlist.length > 0, "environment allowlist required");
check(i.graph.working_directory === "/build/work", "fixed working directory required");
check(i.graph.locale === p.graph.locale_fixed && i.graph.timezone === p.graph.timezone_fixed, "locale/timezone must be fixed");
check(Number.isInteger(i.graph.source_date_epoch), "SOURCE_DATE_EPOCH required");

const ids = new Set(g.actions.map(a => a.id));
check(ids.size === g.actions.length, "action IDs must be unique");
for (const action of g.actions) {
  check(g.toolchains[action.toolchain] && digest(g.toolchains[action.toolchain].digest), `toolchain digest missing: ${action.id}`);
  check(Array.isArray(action.outputs) && action.outputs.length > 0, `declared output missing: ${action.id}`);
  check(action.network === false, `network must be disabled: ${action.id}`);
  check(action.timeout_seconds > 0, `timeout required: ${action.id}`);
  for (const dep of action.deps) check(ids.has(dep), `unknown dependency ${dep}`);
  for (const input of action.inputs) check(digest(input.digest) || ids.has(input.from_action), `unpinned input in ${action.id}`);
  for (const key of Object.keys(action.env ?? {})) check(i.graph.environment_allowlist.includes(key), `unapproved environment variable ${key}`);
}
const visiting = new Set(), visited = new Set();
function visit(id) {
  if (visiting.has(id)) { failures.push(`cycle detected at ${id}`); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  const action = g.actions.find(x => x.id === id);
  for (const dep of action.deps) visit(dep);
  visiting.delete(id);
  visited.add(id);
}
for (const id of ids) visit(id);

check(i.execution.network_disabled && i.execution.sandbox && !i.execution.sandbox_fallback, "strict sandbox without fallback required");
check(!i.execution.host_filesystem_access && !i.execution.host_toolchain_access, "host dependencies forbidden");
check(i.execution.rootless && i.execution.ephemeral && !i.execution.cross_trust_reuse, "ephemeral rootless workers required");
check(i.execution.cpu_limit > 0 && i.execution.memory_mb > 0 && i.execution.timeout_seconds > 0, "resource limits required");
check(i.dependencies.fetch_separate && i.dependencies.fixed_output_only, "fetch must be separate and fixed-output");
check(i.dependencies.lockfile && i.dependencies.mirror && !i.dependencies.public_network && i.dependencies.closure_manifest, "offline dependency closure required");
check(i.reproducibility.builders.length >= p.reproducibility.independent_builders_required, "independent builders required");
check(new Set(i.reproducibility.builders.map(b => b.domain)).size >= p.reproducibility.minimum_failure_domains, "independent builder domains required");
check(i.reproducibility.builders.every(b => b.empty_cache), "reproducibility builds require empty caches");
check(i.reproducibility.byte_identical && i.reproducibility.diffoscope_on_mismatch && i.reproducibility.quarantine_on_mismatch, "byte equality and mismatch quarantine required");
check(!i.reproducibility.cache_hit_used_as_evidence, "cache hits are not reproducibility evidence");
check(i.cache.content_addressed && i.cache.signature_verified && i.cache.read_write_separated && i.cache.untrusted_rehashed, "cache integrity controls required");
check(!i.cache.canonical_artifact_store && i.cache.poisoning_test, "cache cannot be canonical and poisoning must be tested");
check(i.provenance.predicate_type === "https://slsa.dev/provenance/v1", "SLSA v1 provenance required");
check(i.provenance.builder_generated && i.provenance.signed_outside_action && i.provenance.complete_materials, "provenance separation/completeness required");
check(digest(i.provenance.graph_digest) && digest(i.provenance.worker_image_digest) && digest(i.provenance.build_log_digest), "provenance digests required");
check(!i.continuity.github_required && !i.continuity.hosted_ci_required && !i.continuity.original_cache_required && !i.continuity.public_dns_required, "offline/provider-independent rebuild required");
check(i.continuity.offline_toolchain_bundle, "offline toolchain bundle required");
check(i.continuity.last_clean_host_rebuild_age_days <= p.continuity.clean_host_rebuild_max_age_days, "clean-host rebuild is stale");
check(i.continuity.trained_operators >= p.continuity.minimum_trained_operators, "insufficient trained operators");
for (const key of ["machine_generated", "signed", "graph_digest", "action_keys", "input_output_digests", "independent_builder_ids", "reproducibility_result"]) check(i.evidence[key], `evidence missing ${key}`);
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} build invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 61 build invariants");
