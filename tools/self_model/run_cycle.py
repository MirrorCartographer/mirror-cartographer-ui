#!/usr/bin/env python3
"""Deterministic agent-contract audit; no external API or hidden-data access."""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "agents/self-model/agent-registry.json"
OUT = ROOT / "self-model-run-receipt.json"
def main():
    try: data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"registry_error: {exc}", file=sys.stderr); return 2
    agents = data.get("agents", [])
    ids = [a.get("id") for a in agents]
    expected = ["research", "resources", "art", "build", "integration"]
    errors = []
    if ids != expected: errors.append(f"agent_ids_expected_{expected}_got_{ids}")
    rules = data.get("global_rules", {})
    for key, expected_value in [("no_direct_main_writes", True), ("no_auto_merge", True), ("raw_private_conversation_publication", False), ("platform_limit_evasion", False)]:
        if rules.get(key) is not expected_value: errors.append(f"guard_missing_or_wrong:{key}")
    for agent in agents:
        if not agent.get("purpose") or not agent.get("acceptance"): errors.append(f"incomplete_contract:{agent.get('id')}")
    receipt = {
      "schema_version": 1, "timestamp_utc": datetime.now(timezone.utc).isoformat(),
      "run_mode": "deterministic-audit-only", "repository": os.getenv("GITHUB_REPOSITORY", "local"),
      "ref": os.getenv("GITHUB_REF", "local"), "workflow_run_id": os.getenv("GITHUB_RUN_ID"),
      "agent_count": len(agents), "agent_ids": ids,
      "provider_adapter_configured": bool(os.getenv("MC_RESEARCH_PROVIDER")),
      "result": "pass" if not errors else "fail", "errors": errors,
      "limitations": ["No external research is performed.", "No LLM is invoked and no source code is changed.",
      "Passing validates configuration only, not claim truth.", "No platform restriction is bypassed."],
      "next_action": "Implement and test an authorized provider adapter with source-citation, privacy, and output-validation gates." if not os.getenv("MC_RESEARCH_PROVIDER") else "Validate the configured provider adapter before enabling model-assisted runs."
    }
    OUT.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    return 0 if not errors else 1
if __name__ == "__main__": raise SystemExit(main())
