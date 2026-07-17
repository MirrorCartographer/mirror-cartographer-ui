#!/usr/bin/env node
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const root=path.resolve('platform/identity'); const baseline=JSON.parse(fs.readFileSync(path.join(root,'inventory.json'),'utf8')); const policy=path.join(root,'policy.json'); const verifier=path.join(root,'verify-identity-contract.mjs');
function run(name,mutate,shouldPass=false){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundation-identity-'));const x=structuredClone(baseline);mutate(x);const inv=path.join(dir,'inventory.json');fs.writeFileSync(inv,JSON.stringify(x,null,2));const r=spawnSync(process.execPath,[verifier,policy,inv],{encoding:'utf8'});const passed=r.status===0;if(passed!==shouldPass){console.error(r.stdout,r.stderr);throw new Error(`${name}: expected ${shouldPass?'accept':'reject'}, got ${passed?'accept':'reject'}`);}console.log(`PASS ${name}`);}
run('baseline',()=>{},true);
run('reject-provider-root',x=>x.trust_domains[0].provider_derived=true);
run('reject-shared-trust-domain',x=>x.trust_domains[1].environment='production');
run('reject-one-root-copy',x=>x.root_keys.copies=1);
run('reject-no-offline-root',x=>x.root_keys.offline_copies=0);
run('reject-long-svid',x=>x.workload_identity.svid_ttl_minutes=1440);
run('reject-network-workload-api',x=>x.workload_identity.workload_api_endpoint='tcp://0.0.0.0:8081');
run('reject-bootstrap-secret',x=>x.workload_identity.bootstrap_secret=true);
run('reject-no-attestation',x=>x.workload_identity.attestation='');
run('reject-static-database-secret',x=>x.secret_broker.dynamic_database_credentials=false);
run('reject-long-runtime-secret',x=>x.secret_broker.runtime_secret_ttl_minutes=1440);
run('reject-no-revocation',x=>x.secret_broker.leases_revocable=false);
run('reject-plaintext-source-secret',x=>x.encrypted_configuration.plaintext_committed=true);
run('reject-one-recipient-group',x=>{x.encrypted_configuration.recipient_groups=1;x.encrypted_configuration.threshold=1;});
run('reject-secret-manager-sole-recovery',x=>{x.secret_broker.sole_recovery_path=true;x.encrypted_configuration.recovery_export_offline=false;});
run('reject-wildcard-admin',x=>x.authorization.wildcard_admin_bindings=1);
run('reject-one-human-production-operator',x=>x.authorization.production_human_quorum=1);
run('reject-secret-values-in-audit',x=>x.audit.redacts_secret_values=false);
run('reject-stale-recovery-drill',x=>x.recovery.last_drill='2025-01-01T00:00:00Z');
run('reject-dns-only-bootstrap',x=>x.recovery.dns_independent_bootstrap=false);
console.log('PASS adversarial identity/secrets controls');
