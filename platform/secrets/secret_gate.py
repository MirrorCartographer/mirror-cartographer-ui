#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path


def decide(catalog: dict, request: dict) -> dict:
    failures: list[str] = []
    if request.get("catalog_generation") != catalog.get("generation"):
        failures.append("catalog-generation")
    identity = request.get("workload_identity")
    workload = catalog.get("workloads", {}).get(identity)
    if not workload:
        failures.append("unknown-workload")
        return {"decision": "DENY", "failures": failures}
    secret_class = request.get("secret_class")
    if secret_class not in workload.get("allowed_secret_classes", []):
        failures.append("secret-class")
    if request.get("secret_path") not in workload.get("allowed_paths", []):
        failures.append("secret-path")
    ttl = request.get("requested_ttl_seconds", 0)
    class_limit = catalog.get("classes", {}).get(secret_class, {}).get("maximum_ttl_seconds", -1)
    if ttl <= 0 or ttl > min(class_limit, workload.get("maximum_ttl_seconds", class_limit)):
        failures.append("ttl")
    mode = request.get("injection_mode")
    if mode == "environment" and not workload.get("environment_injection"):
        failures.append("environment-injection")
    if mode == "file" and not workload.get("file_injection"):
        failures.append("file-injection")
    if request.get("persist_to_kubernetes_secret") is True:
        failures.append("kubernetes-persistence")
    if request.get("audit_receipt_requested") is not True:
        failures.append("audit-receipt")
    return {"decision": "ISSUE" if not failures else "DENY", "failures": failures}


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: secret_gate.py CATALOG.json REQUEST.json", file=sys.stderr)
        return 2
    catalog = json.loads(Path(sys.argv[1]).read_text())
    request = json.loads(Path(sys.argv[2]).read_text())
    result = decide(catalog, request)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["decision"] == "ISSUE" else 1

if __name__ == "__main__":
    raise SystemExit(main())
