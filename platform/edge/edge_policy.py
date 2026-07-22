from __future__ import annotations
import argparse, hashlib, ipaddress, json
from pathlib import Path
SCHEMA = "fia.edge-ingress-policy.v1"
def digest(value: object) -> str:
    raw=json.dumps(value,sort_keys=True,separators=(",",":")).encode(); return "sha256:"+hashlib.sha256(raw).hexdigest()
def validate(policy: dict) -> list[str]:
    f=[]
    if policy.get("schema")!=SCHEMA:f.append("schema mismatch")
    nodes=policy.get("edge_nodes",[])
    if len(nodes)<2:f.append("at least two edge nodes required")
    domains=set(); providers=set()
    for i,n in enumerate(nodes):
        d=n.get("failure_domain")
        if not d:f.append(f"edge_nodes[{i}] missing failure_domain")
        elif d in domains:f.append("edge nodes share a failure domain")
        else:domains.add(d)
        providers.add(n.get("hosting_provider"))
        try: ipaddress.ip_address(n.get("public_ip",""))
        except ValueError:f.append(f"edge_nodes[{i}] invalid public_ip")
        if n.get("reverse_proxy") not in {"caddy","nginx","haproxy","envoy"}:f.append(f"edge_nodes[{i}] unsupported reverse_proxy")
        if not n.get("health_endpoint","").startswith("/"):f.append(f"edge_nodes[{i}] invalid health_endpoint")
    if len(providers-{None})<2:f.append("edge nodes require different hosting providers")
    tls=policy.get("tls",{})
    if tls.get("automation")!="acme":f.append("TLS automation must use ACME")
    if len(tls.get("certificate_authorities",[]))<2:f.append("at least two ACME certificate authorities required")
    if tls.get("challenge") not in {"http-01","dns-01","tls-alpn-01"}:f.append("unsupported ACME challenge")
    if tls.get("challenge")=="dns-01" and not tls.get("dns_api_exit_path"):f.append("dns-01 requires a DNS API exit path")
    if tls.get("key_storage") not in {"per-node-encrypted","shared-project-controlled"}:f.append("TLS key storage is not project-controlled")
    if tls.get("renewal_alarm_days",0)<14:f.append("renewal alarm must trigger at least 14 days before expiry")
    dns=policy.get("dns",{})
    if dns.get("authoritative_providers",0)<2:f.append("two authoritative DNS providers required")
    if dns.get("ttl_seconds",0)>300:f.append("DNS TTL exceeds 300 seconds")
    if not dns.get("zone_export_path"):f.append("DNS zone export path required")
    if not dns.get("registrar_unlock_recovery"):f.append("registrar recovery procedure required")
    runtime=policy.get("runtime",{})
    if runtime.get("origin_protocol") not in {"http","https","unix"}:f.append("unsupported origin protocol")
    if not runtime.get("local_health_gate"):f.append("local health gate required")
    if not runtime.get("config_test_command"):f.append("reverse proxy config test command required")
    if not runtime.get("atomic_reload_command"):f.append("atomic reload command required")
    failover=policy.get("failover",{})
    if failover.get("max_detection_seconds",10**9)>60:f.append("failure detection exceeds 60 seconds")
    if failover.get("max_dns_convergence_seconds",10**9)>600:f.append("DNS convergence exceeds 600 seconds")
    if not failover.get("manual_override"):f.append("manual failover override required")
    if not failover.get("quarterly_drill"):f.append("quarterly failover drill required")
    own=policy.get("ownership",{})
    for k in ("config","certificates","dns_zone_exports","health_checks","release_authority"):
        if own.get(k)!="project":f.append(f"{k} authority must remain project-owned")
    return sorted(set(f))
def compile_caddy(policy: dict)->str:
    failures=validate(policy)
    if failures: raise ValueError("; ".join(failures))
    r=policy["runtime"]
    return f'''{policy["hostname"]} {{
    encode zstd gzip
    header {{
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }}
    handle {r["public_health_endpoint"]} {{
        respond "ok" 200
    }}
    reverse_proxy {r["origin"]} {{
        health_uri {r["origin_health_endpoint"]}
        health_interval 10s
        health_timeout 2s
        fail_duration 30s
    }}
    log {{
        output file /var/log/fia-edge/access.json
        format json
    }}
}}
'''
def compile_report(policy:dict)->dict:
    failures=validate(policy)
    report={"schema":"fia.edge-ingress-capability.v1","status":"pass" if not failures else "fail","failures":failures,"ownership":policy.get("ownership",{}),"edge_node_count":len(policy.get("edge_nodes",[])),"failure_domain_count":len({n.get("failure_domain") for n in policy.get("edge_nodes",[])}),"hosting_provider_count":len({n.get("hosting_provider") for n in policy.get("edge_nodes",[])}),"policy_digest":digest(policy)}
    report["report_digest"]=digest(report); return report
def main()->int:
    p=argparse.ArgumentParser(); p.add_argument("policy"); p.add_argument("--caddy-out",required=True); p.add_argument("--report-out",required=True); a=p.parse_args()
    policy=json.loads(Path(a.policy).read_text()); report=compile_report(policy); Path(a.report_out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    if report["status"]!="pass": print(json.dumps(report,indent=2)); return 1
    Path(a.caddy_out).write_text(compile_caddy(policy)); print(report["report_digest"]); return 0
if __name__=="__main__": raise SystemExit(main())
