#!/usr/bin/env python3
"""Deterministic five-role audit runner; no external API or hidden-data access."""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "agents/self-model/agent-registry.json"
AGENT_NEXT = {
 "research": "Select one open public-safe question; add primary-source provenance and a falsification route.",
 "resources": "Find one capability gap tied to an existing question; record evidence, license, privacy, cost, and exit path.",
 "art": "Choose one evidence-backed usability objective; specify an editable artifact and accessibility acceptance criteria.",
 "build": "Implement or specify the smallest testable artifact; add a fixture and exact validation command.",
 "integration": "Compare claim labels, privacy boundaries, and handoffs; identify one contradiction or repair target."
}
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
    for key, val in [("no_direct_main_writes", True), ("no_auto_merge", True), ("raw_private_conversation_publication", False), ("platform_limit_evasion", False)]:
        if rules.get(key) is not val: errors.append(f"guard_missing_or_wrong:{key}")
    for agent in agents:
        if not agent.get("purpose") or not agent.get("acceptance"): errors.append(f"incomplete_contract:{agent.get('id')}")
    active = os.getenv("MC_AGENT", "integration")
    if active not in AGENT_NEXT: errors.append(f"unknown_agent:{active}")
    receipt = {
      "schema_version": 1, "timestamp_utc": datetime.now(timezone.utc).isoformat(),
      "run_mode": "deterministic-audit-only", "active_agent": active,
      "repository": os.getenv("GITHUB_REPOSITORY", "local"), "ref": os.getenv("GITHUB_REF", "local"),
      "workflow_run_id": os.getenv("GITHUB_RUN_ID"), "agent_count": len(agents), "agent_ids": ids,
      "provider_adapter_configured": bool(os.getenv("MC_RESEARCH_PROVIDER")),
      "result": "pass" if not errors else "fail", "errors": errors,
      "role_task": AGENT_NEXT.get(active, "Repair the invalid role configuration."),
      "limitations": ["No external research is performed.", "No LLM is invoked and no source code is changed.",
      "Passing validates configuration only, not claim truth.", "No platform restriction is bypassed."],
      "next_action": "Implement and test an authorized provider adapter with source-citation, privacy, and output-validation gates." if not os.getenv("MC_RESEARCH_PROVIDER") else "Validate the configured provider adapter before enabling model-assisted runs."
    }
    out = ROOT / f"self-model-run-receipt-{active}.json"
    out.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    return 0 if not errors else 1
if __name__ == "__main__": raise SystemExit(main())
