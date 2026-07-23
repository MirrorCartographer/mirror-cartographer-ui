#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIFECYCLE = ROOT / "architecture" / "lifecycle.json"
REGISTRY = ROOT / "capabilities" / "registry.json"
REQUIRED = {
    "source-intake","reader-normalization","build-graph","deterministic-build",
    "dependency-custody","artifact-custody","ci-workers","test-orchestration",
    "registries","release-authority","runtime","networking","reverse-proxy","tls",
    "observability","storage","database","queues","backups-restore","secrets-identity",
    "deployment-rollback","scaling","migration","disaster-recovery"
}

def load(path: Path):
    return json.loads(path.read_text())

def canonical_digest(value: object) -> str:
    return "sha256:" + hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()

def verify() -> dict:
    plan = load(LIFECYCLE)
    registry = load(REGISTRY)
    ids = [c["id"] for c in plan["capabilities"]]
    records = {c["id"]: c for c in registry["capabilities"]}
    errors = []
    if plan.get("authority") != "foundation": errors.append("authority")
    if plan.get("hardware_ownership_claim") is not False: errors.append("hardware-boundary")
    if len(ids) != len(set(ids)): errors.append("duplicate-capability")
    missing = sorted(REQUIRED - set(ids))
    if missing: errors.append("missing:" + ",".join(missing))
    if set(records) != set(ids): errors.append("registry-lifecycle-drift")
    for c in plan["capabilities"]:
        if c.get("state") not in {"planned","prototype","operational","verified"}:
            errors.append("invalid-state:" + c.get("id","?"))
            continue
        record = records.get(c["id"], {})
        if record.get("state") != c["state"]: errors.append("state-drift:" + c["id"])
        if record.get("authority") != "foundation": errors.append("capability-authority:" + c["id"])
        if record.get("provider") is not None: errors.append("provider-bound:" + c["id"])
        if not record.get("exit_path"): errors.append("missing-exit:" + c["id"])
        if not record.get("hardware_boundary"): errors.append("missing-hardware-boundary:" + c["id"])
    return {
        "status":"pass" if not errors else "fail",
        "errors":errors,
        "lifecycle_digest":canonical_digest(plan),
        "registry_digest":canonical_digest(registry)
    }

def main():
    parser=argparse.ArgumentParser(prog="fia")
    parser.add_argument("command", choices=["status","verify","plan","capabilities"])
    parser.add_argument("capability", nargs="?")
    args=parser.parse_args()
    plan=load(LIFECYCLE)
    registry=load(REGISTRY)
    if args.command=="verify":
        result=verify(); print(json.dumps(result,indent=2)); raise SystemExit(result["status"]!="pass")
    if args.command=="status":
        counts={}
        for capability in plan["capabilities"]:
            counts[capability["state"]]=counts.get(capability["state"],0)+1
        print(json.dumps({"authority":plan["authority"],"capabilities":len(plan["capabilities"]),"states":counts},indent=2))
    elif args.command=="plan":
        for capability in plan["capabilities"]:
            print(f"{capability['state']:11} {capability['id']}")
    elif args.command=="capabilities":
        records={capability["id"]:capability for capability in registry["capabilities"]}
        if args.capability:
            if args.capability not in records:
                raise SystemExit(f"unknown capability: {args.capability}")
            print(json.dumps(records[args.capability],indent=2))
        else:
            for capability in registry["capabilities"]:
                print(f"{capability['state']:11} {capability['id']}")

if __name__ == "__main__": main()
