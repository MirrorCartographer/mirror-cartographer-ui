#!/usr/bin/env python3
"""Validate Memory Saturation Triage packets.

This validator intentionally uses only the Python standard library so the gate
can run in constrained automation, CI, or local review contexts without extra
package installation.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

REQUIRED_TOP_LEVEL = {
    "packet_id",
    "created_utc",
    "source_status",
    "claim_status",
    "privacy_status",
    "missingness",
    "revision_reason",
    "implementation_status",
    "evidence_strength",
    "candidate_memory_write",
    "existing_memory_region",
    "saturation_assessment",
    "triage_decision",
    "falsification_route",
    "next_executable_action",
}

ENUMS = {
    "source_status": {
        "public_source",
        "preprint",
        "benchmark",
        "clinical_research_institution",
        "dataset",
        "open_source_tool",
        "synthetic_implementation",
    },
    "claim_status": {
        "observation",
        "benchmark_result",
        "method_claim",
        "design_inference",
        "prototype_requirement",
        "unvalidated_hypothesis",
        "blocked_claim",
    },
    "privacy_status": {
        "public_safe",
        "synthetic_only",
        "redacted",
        "placeholderized",
        "local_only",
        "sensitive",
        "blocked",
    },
    "implementation_status": {"proposed", "schema_only", "fixture_tested", "integrated", "deprecated"},
    "evidence_strength": {"weak", "moderate", "strong", "blocked"},
}

HIGH_RISK = {"medium", "high"}


def fail(message: str) -> None:
    raise ValueError(message)


def parse_datetime(value: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception as exc:  # pragma: no cover - exact parser error is not useful here
        raise ValueError(f"created_utc must be ISO-8601 date-time: {exc}") from exc


def require_string(obj: dict, key: str, min_length: int = 1) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or len(value.strip()) < min_length:
        fail(f"{key} must be a string with length >= {min_length}")
    return value


def validate_packet(packet: dict) -> None:
    if not isinstance(packet, dict):
        fail("packet must be a JSON object")

    missing = REQUIRED_TOP_LEVEL - set(packet)
    extra = set(packet) - REQUIRED_TOP_LEVEL
    if missing:
        fail(f"missing required fields: {sorted(missing)}")
    if extra:
        fail(f"unexpected top-level fields: {sorted(extra)}")

    require_string(packet, "packet_id", 8)
    parse_datetime(require_string(packet, "created_utc", 10))

    for field, allowed in ENUMS.items():
        value = packet[field]
        if value not in allowed:
            fail(f"{field} must be one of {sorted(allowed)}")

    missingness = packet["missingness"]
    if not isinstance(missingness, list) or not missingness or not all(isinstance(x, str) and x.strip() for x in missingness):
        fail("missingness must be a non-empty list of strings")

    require_string(packet, "revision_reason", 10)
    require_string(packet, "falsification_route", 20)
    require_string(packet, "next_executable_action", 10)

    candidate = packet["candidate_memory_write"]
    if not isinstance(candidate, dict):
        fail("candidate_memory_write must be an object")
    for key in ["write_type", "summary", "provenance", "reuse_scope"]:
        require_string(candidate, key, 3)
    if candidate["write_type"] not in {"new_fact", "updated_fact", "summary", "pointer", "hypothesis", "blocked_write"}:
        fail("candidate_memory_write.write_type has invalid value")
    if candidate["reuse_scope"] not in {
        "single_session",
        "project_memory",
        "health_research_memory",
        "veterinary_research_memory",
        "scientific_discovery_memory",
        "do_not_reuse",
    }:
        fail("candidate_memory_write.reuse_scope has invalid value")

    region = packet["existing_memory_region"]
    if not isinstance(region, dict):
        fail("existing_memory_region must be an object")
    for key in ["region_name", "age_or_staleness", "retrieval_boundary"]:
        require_string(region, key, 3)
    if not isinstance(region.get("known_collisions"), list):
        fail("existing_memory_region.known_collisions must be a list")

    saturation = packet["saturation_assessment"]
    if not isinstance(saturation, dict):
        fail("saturation_assessment must be an object")
    for risk_key in [
        "retrieval_ambiguity_risk",
        "contradiction_load_risk",
        "privacy_linkage_risk",
        "reasoning_overfit_risk",
    ]:
        if saturation.get(risk_key) not in {"low", "medium", "high"}:
            fail(f"{risk_key} must be low, medium, or high")
    score = saturation.get("saturation_score")
    if not isinstance(score, int) or score < 0 or score > 100:
        fail("saturation_score must be an integer from 0 to 100")
    require_string(saturation, "noise_resilience_check", 10)
    blocked = saturation.get("blocked_inferences")
    if not isinstance(blocked, list) or not blocked or not all(isinstance(x, str) and x.strip() for x in blocked):
        fail("blocked_inferences must be a non-empty list of strings")

    decision = packet["triage_decision"]
    if not isinstance(decision, dict):
        fail("triage_decision must be an object")
    if decision.get("decision") not in {"promote", "summarize_then_promote", "store_pointer_only", "redact_then_promote", "defer", "block"}:
        fail("triage_decision.decision has invalid value")
    if decision.get("storage_mode") not in {"verbatim", "summary", "typed_placeholder", "pointer", "local_only", "none"}:
        fail("triage_decision.storage_mode has invalid value")
    require_string(decision, "reason", 20)

    risks = [
        saturation["retrieval_ambiguity_risk"],
        saturation["contradiction_load_risk"],
        saturation["privacy_linkage_risk"],
        saturation["reasoning_overfit_risk"],
    ]
    if any(r in HIGH_RISK for r in risks) and decision["decision"] == "promote" and decision["storage_mode"] == "verbatim":
        fail("high/medium saturation risk cannot be promoted verbatim")

    if packet["privacy_status"] in {"sensitive", "blocked"} and decision["storage_mode"] == "verbatim":
        fail("sensitive or blocked privacy status cannot use verbatim storage")

    if score >= 60 and decision["decision"] in {"promote", "summarize_then_promote"} and decision["storage_mode"] == "verbatim":
        fail("saturation_score >= 60 requires non-verbatim storage")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: validate_memory_saturation_triage_packet.py <packet.json>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    packet = json.loads(path.read_text(encoding="utf-8"))
    validate_packet(packet)
    print(f"VALID: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
