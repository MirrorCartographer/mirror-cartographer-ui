#!/usr/bin/env node
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import {spawnSync} from "node:child_process";
const h=path.dirname(new URL(import.meta.url).pathname), p=path.join(h,"policy.json"), v=path.join(h,"verify-test-orchestration-contract.mjs");
const base=JSON.parse(fs.readFileSync(path.join(h,"inventory.json"),"utf8"));
const mutations=[
["ci-authority",x=>x.authority.ci_provider_authoritative=true],["one-runner",x=>x.execution.runner_implementations=x.execution.runner_implementations.slice(0,1)],
["open-network",x=>x.execution.network_policy="allow"],["persistent-environment",x=>x.execution.ephemeral_environment=false],
["fixed-order",x=>x.execution.test_order_randomization=false],["unrecorded-seed",x=>x.execution.seed_recorded=false],
["missing-shard-pass",x=>x.sharding.missing_shard_fails=false],["no-coverage-reconciliation",x=>x.sharding.coverage_reconciliation=false],
["framework-result-authority",x=>x.results.canonical_schema="junit"],["unsigned-results",x=>x.results.signed=false],
["retry-erases-failure",x=>x.flaky.retry_can_convert_to_pass=true],["permanent-quarantine",x=>x.flaky.maximum_quarantine_days=365],
["silent-quarantine",x=>x.flaky.quarantined_release_gate="ignore"],["xpass-ignored",x=>x.flaky.xpass_fails=false],
["missing-results-pass",x=>x.gates.missing_results_fail_closed=false],["infrastructure-pass",x=>x.gates.infrastructure_error_is_pass=true],
["no-mutation-gate",x=>x.gates.mutation_threshold_percent=0],["no-security-tests",x=>x.gates.security_tests=false],
["shared-benchmark-pool",x=>x.performance.dedicated_pool=false],["tiny-benchmark-sample",x=>x.performance.sample_size=3],
["ci-required-for-recovery",x=>x.continuity.original_ci_required=true],["public-network-required",x=>x.continuity.public_network_required=true],
["stale-clean-host-replay",x=>x.continuity.last_clean_host_replay_age_days=31],["one-operator",x=>x.continuity.trained_operators=1],
["unsigned-evidence",x=>x.evidence.signed=false],["one-evidence-signer",x=>x.evidence.operator_signatures=1]
];
function run(x){const d=fs.mkdtempSync(path.join(os.tmpdir(),"test-contract-")),f=path.join(d,"inventory.json");fs.writeFileSync(f,JSON.stringify(x));const r=spawnSync(process.execPath,[v,p,f],{encoding:"utf8"});fs.rmSync(d,{recursive:true,force:true});return r}
let r=run(base);if(r.status!==0){console.error(r.stderr);process.exit(1)}console.log("PASS baseline");
for(const [name,mutate] of mutations){const x=structuredClone(base);mutate(x);r=run(x);if(r.status===0){console.error(`FAIL ${name}`);process.exit(1)}console.log(`PASS ${name}`)}
const a=path.join(os.tmpdir(),"plan-a.json"),b=path.join(os.tmpdir(),"plan-b.json"),catalog=path.join(h,"sample-catalog.json"),compiler=path.join(h,"compile-plan.mjs");
for(const out of [a,b]){r=spawnSync(process.execPath,[compiler,catalog,out],{encoding:"utf8"});if(r.status!==0)process.exit(1)}
if(fs.readFileSync(a,"utf8")!==fs.readFileSync(b,"utf8")){console.error("FAIL nondeterministic plan");process.exit(1)}
console.log(`PASS ${mutations.length} adversarial mutations`);console.log("PASS deterministic plan compilation");
