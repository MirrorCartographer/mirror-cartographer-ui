#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

SCHEMA = "fia.ci-worker-policy.v1"

def digest(value):
    raw=json.dumps(value,sort_keys=True,separators=(",",":")).encode()
    return "sha256:"+hashlib.sha256(raw).hexdigest()

def validate(p):
    f=[]
    if p.get("schema") != SCHEMA: f.append("schema mismatch")
    if p.get("runner_mode") not in {"jit","ephemeral"}: f.append("runner_mode must be jit or ephemeral")
    if p.get("jobs_per_worker") != 1: f.append("jobs_per_worker must equal 1")
    if not p.get("destroy_after_job"): f.append("destroy_after_job required")
    if not p.get("fresh_rootfs_per_job"): f.append("fresh_rootfs_per_job required")
    if p.get("privileged"): f.append("privileged execution rejected")
    if p.get("host_docker_socket"): f.append("host Docker socket rejected")
    if p.get("host_network"): f.append("host network rejected")
    if p.get("mount_home"): f.append("host home mount rejected")
    if p.get("mount_repo_credentials"): f.append("repository credential mount rejected")
    if p.get("network",{}).get("default") != "deny": f.append("default-deny network required")
    if not p.get("network",{}).get("egress_proxy"): f.append("egress proxy required")
    if p.get("secrets",{}).get("delivery") != "job-scoped": f.append("job-scoped secret delivery required")
    if p.get("secrets",{}).get("persistence") != "none": f.append("secret persistence must equal none")
    if p.get("logs",{}).get("external_retention_days",0) < 30: f.append("external runner-log retention must be at least 30 days")
    if not p.get("logs",{}).get("content_digest"): f.append("content-digested logs required")
    if not p.get("resources",{}).get("cpu_max"): f.append("cpu_max required")
    if not p.get("resources",{}).get("memory_max"): f.append("memory_max required")
    if not p.get("resources",{}).get("pids_max"): f.append("pids_max required")
    if not p.get("supply_chain",{}).get("image_digest", "").startswith("sha256:"): f.append("digest-pinned worker image required")
    if not p.get("supply_chain",{}).get("offline_dependency_cache"): f.append("offline dependency cache required")
    if not p.get("recovery",{}).get("second_operator_runbook"): f.append("second-operator runbook required")
    if not p.get("recovery",{}).get("quarterly_rebuild_drill"): f.append("quarterly rebuild drill required")
    return sorted(set(f))

def compile_policy(p):
    failures=validate(p)
    if failures: raise ValueError("; ".join(failures))
    n=p["name"]
    image=p["supply_chain"]["image"]+"@"+p["supply_chain"]["image_digest"]
    proxy=p["network"]["egress_proxy"]
    podman=[
      "podman","run","--rm","--read-only","--cap-drop=ALL",
      "--security-opt=no-new-privileges","--network=none",
      f"--cpus={p['resources']['cpu_max']}",
      f"--memory={p['resources']['memory_max']}",
      f"--pids-limit={p['resources']['pids_max']}",
      "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=512m",
      "--tmpfs=/work:rw,nosuid,nodev,size=8g",
      "--env",f"HTTPS_PROXY={proxy}","--env",f"HTTP_PROXY={proxy}",
      image,"/opt/fia/run-jit-worker"
    ]
    unit=f"""[Unit]
Description=FIA one-job CI worker {n}
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=fia-runner
Group=fia-runner
ExecStart={' '.join(podman)}
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
SystemCallArchitectures=native
UMask=0077
TimeoutStartSec={p['timeout_seconds']}

[Install]
WantedBy=multi-user.target
"""
    report={"schema":"fia.ci-worker-capability.v1","status":"pass","policy_digest":digest(p),
            "worker_name":n,"jobs_per_worker":1,"fresh_rootfs":True,"network_default":"deny",
            "privileged":False,"host_socket":False,"external_log_retention_days":p["logs"]["external_retention_days"]}
    report["report_digest"]=digest(report)
    return unit, report

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("policy"); ap.add_argument("--unit-out",required=True); ap.add_argument("--report-out",required=True)
    a=ap.parse_args()
    p=json.loads(Path(a.policy).read_text())
    unit,report=compile_policy(p)
    Path(a.unit_out).write_text(unit)
    Path(a.report_out).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(report["report_digest"])
if __name__=="__main__": main()
