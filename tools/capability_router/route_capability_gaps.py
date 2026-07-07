#!/usr/bin/env python3
"""Public-safe capability gap router for Mirror Cartographer discovery artifacts.

This tool validates synthetic capability-gap routing records and maps each
required capability to compatible public capability profiles. It does not make
scientific, medical, veterinary, or therapeutic claims.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ALLOWED_ARTIFACT_TYPES = {
    "phenomenon",
    "hypothesis",
    "mechanism",
    "prediction",
    "dataset",
    "evaluation",
    "prototype",
}

ALLOWED_CATEGORIES = {
    "measurement",
    "simulation",
    "analysis",
    "replication",
    "benchmark",
    "implementation",
}

ALLOWED_PRIORITIES = {"low", "medium", "high", "critical"}
PRIORITY_SCORE = {"critical": 4, "high": 3, "medium": 2, "low": 1}


@dataclass(frozen=True)
class ValidationResult:
    case_id: str
    passed: bool
    errors: Tuple[str, ...]
    routes: Tuple[Dict[str, Any], ...]


def _require_string(record: Dict[str, Any], key: str, errors: List[str]) -> None:
    if not isinstance(record.get(key), str) or not record.get(key, "").strip():
        errors.append(f"missing_or_invalid_{key}")


def _metadata_is_public(record: Dict[str, Any]) -> bool:
    metadata = record.get("metadata")
    return isinstance(metadata, dict) and metadata.get("privacy_status") == "public"


def _profile_matches_constraints(profile: Dict[str, Any], constraints: Dict[str, Any]) -> bool:
    if constraints.get("requires_open_data") and not profile.get("supports_open_data"):
        return False
    if constraints.get("requires_open_code") and not profile.get("supports_open_code"):
        return False
    if constraints.get("requires_reproducibility") and not profile.get("supports_reproducibility"):
        return False
    return True


def validate_and_route(record: Dict[str, Any], registry: Iterable[Dict[str, Any]]) -> ValidationResult:
    errors: List[str] = []
    case_id = record.get("case_id", record.get("router_id", "unknown_case"))

    _require_string(record, "router_id", errors)

    artifact_reference = record.get("artifact_reference")
    if not isinstance(artifact_reference, dict):
        errors.append("missing_artifact_reference")
    else:
        if artifact_reference.get("artifact_type") not in ALLOWED_ARTIFACT_TYPES:
            errors.append("invalid_artifact_type")
        if not isinstance(artifact_reference.get("artifact_id"), str) or not artifact_reference.get("artifact_id"):
            errors.append("missing_artifact_id")

    capabilities = record.get("required_capabilities")
    if not isinstance(capabilities, list) or not capabilities:
        errors.append("missing_required_capabilities")
        capabilities = []

    seen_capability_ids = set()
    routes: List[Dict[str, Any]] = []
    constraints = record.get("routing_constraints") if isinstance(record.get("routing_constraints"), dict) else {}

    registry_by_category: Dict[str, List[Dict[str, Any]]] = {}
    for profile in registry:
        category = profile.get("category")
        registry_by_category.setdefault(category, []).append(profile)

    for capability in capabilities:
        if not isinstance(capability, dict):
            errors.append("invalid_capability_record")
            continue

        capability_id = capability.get("capability_id")
        if not isinstance(capability_id, str) or not capability_id:
            errors.append("missing_capability_id")
            continue
        if capability_id in seen_capability_ids:
            errors.append(f"duplicate_capability_id:{capability_id}")
        seen_capability_ids.add(capability_id)

        category = capability.get("category")
        priority = capability.get("priority")
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"invalid_capability_category:{capability_id}")
            continue
        if priority not in ALLOWED_PRIORITIES:
            errors.append(f"invalid_priority:{capability_id}")
        if not isinstance(capability.get("reason"), str) or not capability.get("reason"):
            errors.append(f"missing_reason:{capability_id}")

        candidates = [
            profile for profile in registry_by_category.get(category, [])
            if _profile_matches_constraints(profile, constraints)
        ]
        if not candidates:
            errors.append(f"no_matching_profile:{capability_id}")
        else:
            routes.append({
                "capability_id": capability_id,
                "category": category,
                "priority": priority,
                "priority_score": PRIORITY_SCORE.get(priority, 0),
                "matched_profile_id": sorted(profile["profile_id"] for profile in candidates)[0],
                "reason": capability.get("reason"),
            })

    success_criteria = record.get("success_criteria")
    if not isinstance(success_criteria, list) or not success_criteria:
        errors.append("missing_success_criteria")
    elif not all(isinstance(item, str) and item.strip() for item in success_criteria):
        errors.append("invalid_success_criteria")

    if not _metadata_is_public(record):
        errors.append("non_public_metadata")

    routes_sorted = tuple(sorted(routes, key=lambda item: (-item["priority_score"], item["capability_id"])))
    return ValidationResult(case_id=case_id, passed=not errors, errors=tuple(sorted(errors)), routes=routes_sorted)


def run_fixture(path: Path) -> Dict[str, Any]:
    payload = json.loads(path.read_text())
    registry = payload.get("capability_registry", [])
    results = [validate_and_route(record, registry) for record in payload.get("records", [])]

    return {
        "fixture_set_id": payload.get("fixture_set_id"),
        "source_status": payload.get("source_status"),
        "claim_status": "infrastructure_routing_report",
        "privacy_status": payload.get("privacy_status"),
        "summary": {
            "total_cases": len(results),
            "passed_cases": sum(1 for result in results if result.passed),
            "failed_cases": sum(1 for result in results if not result.passed),
        },
        "results": [
            {
                "case_id": result.case_id,
                "passed": result.passed,
                "errors": list(result.errors),
                "routes": list(result.routes),
            }
            for result in results
        ],
    }


def main(argv: List[str]) -> int:
    fixture_path = Path(argv[1]) if len(argv) > 1 else Path(__file__).with_name("fixtures.synthetic.json")
    report = run_fixture(fixture_path)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
