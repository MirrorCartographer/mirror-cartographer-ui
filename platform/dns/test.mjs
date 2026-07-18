#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here,"policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here,"inventory.json"),"utf8"));
const verifier = path.join(here,"verify-dns-contract.mjs");
const mutations = [
["reject-registrar-authority",x=>x.authority.registrar_zone_authority=true],
["reject-provider-authority",x=>x.authority.provider_zone_authority=true],
["reject-no-export",x=>x.authority.exportable=false],
["reject-no-registrar-lock",x=>x.domain.registrar_lock=false],
["reject-no-registry-lock",x=>x.domain.registry_lock=false],
["reject-no-autorenew",x=>x.domain.auto_renew=false],
["reject-late-expiry-alert",x=>x.domain.expiry_alert_days=30],
["reject-one-registrar",x=>x.domain.registrar_accounts=["registrar-a"]],
["reject-one-transfer-operator",x=>x.domain.transfer_operator_count=1],
["reject-no-zone-source",x=>x.zone.source_controlled=false],
["reject-no-lint",x=>x.zone.lint_passed=false],
["reject-three-ns",x=>x.zone.authoritative_servers=x.zone.authoritative_servers.slice(0,3)],
["reject-one-operator",x=>x.zone.authoritative_servers.forEach(n=>n.operator="op-a")],
["reject-two-domains",x=>x.zone.authoritative_servers.forEach((n,j)=>n.domain=j%2?"site-a":"site-b")],
["reject-visible-primary",x=>x.zone.hidden_primary=false],
["reject-unauth-transfer",x=>x.zone.transfer_auth="none"],
["reject-unrestricted-update",x=>x.zone.dynamic_update_scope="unrestricted"],
["reject-no-dnssec",x=>x.dnssec.enabled=false],
["reject-online-ksk",x=>x.dnssec.ksk_offline=false],
["reject-two-ksk-copies",x=>x.dnssec.ksk_copies=x.dnssec.ksk_copies.slice(0,2)],
["reject-no-rollover",x=>x.dnssec.prepublication_rollover=false],
["reject-late-signature-alert",x=>x.dnssec.signature_expiry_alert_hours=24],
["reject-unverified-ds",x=>x.dnssec.parent_ds_verified=false],
["reject-broken-cds",x=>x.dnssec.cds_cdnskey_continuity=false],
["reject-single-provider",x=>x.publishing.multi_provider=false],
["reject-shared-provider-creds",x=>x.publishing.provider_credentials_separated=false],
["reject-writer-transfer",x=>x.publishing.writer_can_transfer_domain=true],
["reject-no-known-good",x=>x.publishing.last_known_good=false],
["reject-no-provider-loss-test",x=>x.publishing.provider_loss_tested=false],
["reject-no-registrar-outage-test",x=>x.resilience.registrar_outage=false],
["reject-no-bad-zone-test",x=>x.resilience.bad_zone_rejected=false],
["reject-public-dns-recovery",x=>x.resilience.internal_recovery_without_public_dns=false],
["reject-no-mfa",x=>x.security.mfa=false],
["reject-email-sole-recovery",x=>x.security.shared_email_sole_recovery=true],
["reject-dns-creds-on-edge",x=>x.security.dns_api_credentials_on_edge=true],
["reject-release-keys",x=>x.security.release_keys_on_dns_hosts=true],
["reject-local-audit",x=>x.security.audit_externalized=false],
["reject-unsigned-evidence",x=>x.evidence.signed=false],
["reject-no-chain-validation",x=>x.evidence.dnssec_chain_validation=false],
["reject-one-evidence-operator",x=>x.evidence.operator_signatures=1]
];
function run(inv){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"dns-contract-"));
 const f=path.join(d,"inventory.json"); fs.writeFileSync(f,JSON.stringify(inv,null,2));
 const r=spawnSync(process.execPath,[verifier,policy,f],{encoding:"utf8"});
 fs.rmSync(d,{recursive:true,force:true}); return r;
}
let r=run(base); if(r.status!==0){console.error(r.stdout,r.stderr);process.exit(1)} console.log("PASS baseline");
for(const [name,mutate] of mutations){const x=structuredClone(base);mutate(x);r=run(x);if(r.status===0){console.error(`FAIL ${name}`);process.exit(1)}console.log(`PASS ${name}`)}
console.log("PASS adversarial DNS/domain controls");
