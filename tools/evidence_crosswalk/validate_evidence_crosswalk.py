#!/usr/bin/env python3
"""Validate public-safe Mirror Cartographer evidence crosswalk records.

This tool is discovery infrastructure only. It does not validate medical,
therapeutic, veterinary, or scientific truth claims. It validates whether a
crosswalk record is structurally usable, public-safe, and explicit about
limitations and falsification routes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ALLOWED_ARTIFACT_TYPES = {
    "phenomenon",
    "hypothesis",
    "mechanism",
    "prediction",
    "evaluation",
    "prototype",
}

ALLOWED_EVIDENCE_TYPES = {
    "literature",
    "benchmark",
    "simulation",
    "synthetic_fixture",
    "external_dataset",
    "negative_result",
    "replication",
}

ALLOWED_ALIGNMENT = {
    "supports",
    "contradicts",
    "constrains",
    "insufficient",
    "unrelated",
}

ALLOWED_SOURCE_STATUS = {
    "synthetic",
    "public_reference",
    "derived_public_safe",
}

ALLOWED_CLAIM_STATUS = {
    "planning_fixture",
    "evidence_mapping",
    "test_fixture",
    "non_claim",
}

PRIVATE_MARKERS = {
    "private",
    "personal",
    "household",
    "health",
    "animal-care",
    "financial",
    "location",
    "relationship",
    "credential",
    "raw transcript",
}

REQUIRED_FIELDS = [
    "crosswalk_id",
    "artifact_reference",
    "evidence_items",
    "claim_status",
    "source_status",
    "privacy_status",
    "missingness",
    "revision_reason",
    "implementation_status",
    "testability",
    "falsification_route",
    "next_executable_action",
]


def _contains_private_marker(value: Any) -> bool:
    if isinstance(value, str):
        lowered = value.lower()
        return any(marker in lowered for marker in PRIVATE_MARKERS)
    if isinstance(value, dict):
        return any(_contains_private_marker(v) for v in value.values())
    if isinstance(value, list):
        return any(_contains_private_marker(v) for v in value)
    return False


def validate_record(record: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    errors: List[str] = []

    for field in REQUIRED_FIELDS:
        if field not in record:
            errors.append(f"missing required field: {field}")

    if record.get("privacy_status") != "public":
        errors.append("privacy_status must be public")

    if record.get("source_status") not in ALLOWED_SOURCE_STATUS:
        errors.append("source_status is not allowed")

    if record.get("claim_status") not in ALLOWED_CLAIM_STATUS:
        errors.append("claim_status is not allowed")

    artifact_reference = record.get("artifact_reference", {})
    artifact_type = artifact_reference.get("artifact_type")
    if artifact_type not in ALLOWED_ARTIFACT_TYPES:
        errors.append("artifact_reference.artifact_type is not allowed")
    if not artifact_reference.get("artifact_id"):
        errors.append("artifact_reference.artifact_id is required")

    evidence_items = record.get("evidence_items")
    if not isinstance(evidence_items, list) or not evidence_items:
        errors.append("evidence_items must contain at least one item")
        evidence_items = []

    evidence_ids = set()
    alignments = {name: 0 for name in ALLOWED_ALIGNMENT}
    for index, item in enumerate(evidence_items):
        evidence_id = item.get("evidence_id")
        if not evidence_id:
            errors.append(f"evidence_items[{index}] missing evidence_id")
        elif evidence_id in evidence_ids:
            errors.append(f"duplicate evidence_id: {evidence_id}")
        else:
            evidence_ids.add(evidence_id)

        if item.get("evidence_type") not in ALLOWED_EVIDENCE_TYPES:
            errors.append(f"evidence_items[{index}] evidence_type is not allowed")

        alignment = item.get("alignment")
        if alignment not in ALLOWED_ALIGNMENT:
            errors.append(f"evidence_items[{index}] alignment is not allowed")
        else:
            alignments[alignment] += 1

        if not item.get("summary"):
            errors.append(f"evidence_items[{index}] missing summary")
        if not item.get("limitation"):
            errors.append(f"evidence_items[{index}] missing limitation")
        if not item.get("minimum_use"):
            errors.append(f"evidence_items[{index}] missing minimum_use")

    if not record.get("falsification_route"):
        errors.append("falsification_route is required")

    if _contains_private_marker(record):
        errors.append("record contains a blocked private marker")

    report = {
        "crosswalk_id": record.get("crosswalk_id"),
        "valid": not errors,
        "errors": errors,
        "item_count": len(evidence_items),
        "alignment_counts": alignments,
        "has_contradiction": alignments["contradicts"] > 0,
        "has_constraint": alignments["constrains"] > 0,
    }
    return not errors, errors, report


def validate_fixture_file(path: Path) -> int:
    payload = json.loads(path.read_text())
    failures = 0
    reports = []
    for fixture in payload.get("fixtures", []):
        valid, _errors, report = validate_record(fixture["record"])
        expected = bool(fixture["expected_valid"])
        report["fixture_name"] = fixture.get("name")
        report["expected_valid"] = expected
        report["matches_expected"] = valid == expected
        reports.append(report)
        if valid != expected:
            failures += 1
    print(json.dumps({"reports": reports, "failure_count": failures}, indent=2, sort_keys=True))
    return 1 if failures else 0


def main(argv: Iterable[str]) -> int:
    args = list(argv)
    if len(args) != 2:
        print("usage: validate_evidence_crosswalk.py fixtures.synthetic.json", file=sys.stderr)
        return 2
    return validate_fixture_file(Path(args[1]))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
