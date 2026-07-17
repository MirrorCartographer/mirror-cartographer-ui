import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname);
const baseP=JSON.parse(fs.readFileSync(path.join(here,'policy.json'))); const baseI=JSON.parse(fs.readFileSync(path.join(here,'inventory.json')));
const cases=[
['baseline',()=>{},true],
['reject-provider-authority',p=>p.authority.provider_is_not_routing_authority=false],
['reject-one-ingress',p=>p.topology.ingress_nodes=1],
['reject-one-domain',(p,i)=>i.ingress_nodes[1].failure_domain='site-a'],
['reject-public-backend',(p,i)=>i.ingress_nodes[0].backend_bind='0.0.0.0'],
['reject-no-zone-export',p=>p.dns.zone_exportable=false],
['reject-no-secondary-dns',p=>p.dns.secondary_authoritative_copy=false],
['reject-no-registrar-lock',p=>p.dns.registrar_lock_enabled=false],
['reject-no-dnssec-recovery',p=>p.dns.ds_recovery_documented=false],
['reject-high-ttl',p=>p.dns.ttl_seconds=86400],
['reject-dns-only-origin',p=>p.dns.out_of_band_origin_access=false],
['reject-old-tls',p=>p.tls.minimum_version='1.0'],
['reject-one-ca',(p,i)=>i.tls.issuers=['acme-primary']],
['reject-shared-acme-cert-key',p=>p.tls.acme_account_key_separate_from_certificate_key=false],
['reject-one-account-key-copy',(p,i)=>i.tls.account_key_copies=['online-sealed']],
['reject-ephemeral-cert-storage',p=>p.tls.certificate_storage_persistent=false],
['reject-one-cert-store',(p,i)=>i.tls.storage_copies=['site-a-encrypted']],
['reject-no-caa',p=>p.tls.caa_restricts_issuers=false],
['reject-on-demand-tls',p=>p.tls.on_demand_tls_disabled=false],
['reject-ca-dependent-restart',p=>p.continuity.proxy_restart_survives_ca_outage=false],
['reject-dns-dependent-rollback',p=>p.continuity.public_dns_not_required_for_rollback=false],
['reject-no-external-tls-probe',p=>p.continuity.tls_handshake_probed_externally=false],
['reject-unsigned-failover',(p,i)=>i.evidence.signed=false],
['reject-one-operator',(p,i)=>i.evidence.operators=['operator-a']]
];
for(const [name,mutate,shouldPass=false] of cases){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'net-contract-')); const p=structuredClone(baseP),i=structuredClone(baseI); mutate(p,i); fs.writeFileSync(path.join(dir,'policy.json'),JSON.stringify(p)); fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify(i)); fs.copyFileSync(path.join(here,'verify-network-contract.mjs'),path.join(dir,'verify-network-contract.mjs')); const r=spawnSync(process.execPath,[path.join(dir,'verify-network-contract.mjs')],{encoding:'utf8'}); const passed=r.status===0; if(passed!==shouldPass){console.error(`FAIL ${name}\n${r.stdout}${r.stderr}`); process.exit(1);} console.log(`PASS ${name}`);}
console.log('PASS adversarial network/TLS controls');
