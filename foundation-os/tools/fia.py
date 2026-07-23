#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIFECYCLE = ROOT / "architecture" / "lifecycle.json"
CATALOG = ROOT / "archives" / "run-catalog.json"
REQUIRED = {
    "source-intake","reader-normalization","build-graph","deterministic-build",
    "dependency-custody","artifact-custody","ci-workers","test-orchestration",
    "registries","release-authority","runtime","networking","reverse-proxy","tls",
    "observability","storage","database","queues","backups-restore","secrets-identity",
    "deployment-rollback","scaling","migration","disaster-recovery"
}

def load(path: Path):
    return json.loads(path.read_text())

def verify() -> dict:
    plan = load(LIFECYCLE)
    ids = [c["id"] for c in plan["capabilities"]]
    errors = []
    if plan.get("authority") != "foundation": errors.append("authority")
    if plan.get("hardware_ownership_claim") is not False: errors.append("hardware-boundary")
    if len(ids) != len(set(ids)): errors.append("duplicate-capability")
    missing = sorted(REQUIRED - set(ids))
    if missing: errors.append("missing:" + ",".join(missing))
    for c in plan["capabilities"]:
        if c.get("state") not in {"planned","prototype","operational","verified"}:
            errors.append("invalid-state:" + c.get("id","?"))
    digest = hashlib.sha256(json.dumps(plan,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return {"status":"pass" if not errors else "fail","errors":errors,"digest":"sha256:"+digest}

def main():
    p=argparse.ArgumentParser(prog="fia")
    p.add_argument("command", choices=["status","verify","plan"])
    a=p.parse_args()
    plan=load(LIFECYCLE)
    if a.command=="verify":
        result=verify(); print(json.dumps(result,indent=2)); raise SystemExit(result["status"]!="pass")
    if a.command=="status":
        counts={}
        for c in plan["capabilities"]: counts[c["state"]]=counts.get(c["state"],0)+1
        print(json.dumps({"authority":plan["authority"],"capabilities":len(plan["capabilities"]),"states":counts},indent=2))
    if a.command=="plan":
        for c in plan["capabilities"]: print(f"{c['state']:11} {c['id']}")

if __name__ == "__main__": main()
