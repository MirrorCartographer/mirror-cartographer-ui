#!/usr/bin/env python3
"""Public-safe discovery ladder audit harness.

This tool evaluates synthetic/public Mirror Cartographer discovery manifests and
identifies the weakest discovery ladder rung by executable coverage.

It intentionally does not process private transcripts, personal records, health
records, animal-care records, location data, financial data, relationship data,
or credentials.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

REQUIRED_TOP_LEVEL_LABELS = {
    "schema_version",
    "fixture_set_id",
    "source_status",
    "claim_status",
    "privacy_status",
    "artifacts",
}

REQUIRED_ARTIFACT_FIELDS = {
    "artifact_id",
    "rung",
    "artifact_type",
    "implementation_status",
    "testability",
    "has_schema",
    "has_fixture",
    "has_validator",
    "has_tests",
    "has_acceptance_criteria",
    "has_falsification_route",
    "missingness",
}

PRIVATE_MARKERS = {
    "private",
    "personal",
    "household",
    "health",
    "animal",
    "financial",
    "location",
    "relationship",
    "credential",
    "transcript",
    "address",
    "phone",
    "email",
}

RUNG_NAMES = {
    1: "unresolved phenomenon map",
    2: "novel hypothesis",
    3: "mechanistic model",
    4: "falsifiable prediction",
    5: "synthetic fixture or dataset schema",
    6: "evaluation/test harness",
    7: "prototype/tool/code",
    8: "literature/evidence crosswalk",
    9: "collaborator/opportunity path",
    10: "failed-result or contradiction ledger",
}

IMPLEMENTATION_WEIGHTS = {
    "none": 0.0,
    "plan": 0.1,
    "schema_only": 0.25,
    "prototype": 0.7,
    "implemented": 1.0,
}

TESTABILITY_WEIGHTS = {
    "none": 0.0,
    "low": 0.25,
    "medium": 0.55,
    "high": 1.0,
}


@dataclass(frozen=True)
class RungScore:
    rung: int
    name: str
    score: float
    artifact_count: int
    reasons: List[str]
    next_executable_action: str


def load_manifest(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def contains_private_marker(value: Any) -> bool:
    if isinstance(value, dict):
        return any(contains_private_marker(k) or contains_private_marker(v) for k, v in value.items())
    if isinstance(value, list):
        return any(contains_private_marker(item) for item in value)
    if isinstance(value, str):
        lowered = value.lower()
        return any(marker in lowered for marker in PRIVATE_MARKERS)
    return False


def validate_manifest(manifest: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    missing_top_level = REQUIRED_TOP_LEVEL_LABELS - set(manifest)
    if missing_top_level:
        errors.append(f"missing top-level labels: {sorted(missing_top_level)}")

    if manifest.get("source_status") != "synthetic":
        errors.append("source_status must be synthetic")
    if manifest.get("claim_status") != "evaluation_fixture":
        errors.append("claim_status must be evaluation_fixture")
    if manifest.get("privacy_status") != "public":
        errors.append("privacy_status must be public")

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        errors.append("artifacts must be a non-empty list")
        return errors

    seen_ids = set()
    for index, artifact in enumerate(artifacts):
        if not isinstance(artifact, dict):
            errors.append(f"artifact {index} is not an object")
            continue

        missing_fields = REQUIRED_ARTIFACT_FIELDS - set(artifact)
        if missing_fields:
            errors.append(f"artifact {index} missing fields: {sorted(missing_fields)}")

        artifact_id = artifact.get("artifact_id")
        if artifact_id in seen_ids:
            errors.append(f"duplicate artifact_id: {artifact_id}")
        seen_ids.add(artifact_id)

        rung = artifact.get("rung")
        if rung not in RUNG_NAMES:
            errors.append(f"artifact {artifact_id} has invalid rung: {rung}")

        if artifact.get("implementation_status") not in IMPLEMENTATION_WEIGHTS:
            errors.append(f"artifact {artifact_id} has invalid implementation_status")

        if artifact.get("testability") not in TESTABILITY_WEIGHTS:
            errors.append(f"artifact {artifact_id} has invalid testability")

        if not isinstance(artifact.get("missingness"), list):
            errors.append(f"artifact {artifact_id} missingness must be a list")

        for boolean_field in (
            "has_schema",
            "has_fixture",
            "has_validator",
            "has_tests",
            "has_acceptance_criteria",
            "has_falsification_route",
        ):
            if not isinstance(artifact.get(boolean_field), bool):
                errors.append(f"artifact {artifact_id} {boolean_field} must be boolean")

    # Top-level fixture labels use the word public, so only scan artifacts.
    if contains_private_marker(artifacts):
        errors.append("manifest artifacts contain a blocked private marker")

    return errors


def artifact_score(artifact: Dict[str, Any]) -> Tuple[float, List[str]]:
    reasons: List[str] = []

    status_score = IMPLEMENTATION_WEIGHTS[artifact["implementation_status"]]
    testability_score = TESTABILITY_WEIGHTS[artifact["testability"]]
    component_score = sum(
        1.0 if artifact[field] else 0.0
        for field in (
            "has_schema",
            "has_fixture",
            "has_validator",
            "has_tests",
            "has_acceptance_criteria",
            "has_falsification_route",
        )
    ) / 6.0

    score = round((0.35 * status_score) + (0.25 * testability_score) + (0.40 * component_score), 4)

    if not artifact["has_fixture"]:
        reasons.append("missing synthetic fixture")
    if not artifact["has_validator"]:
        reasons.append("missing validator")
    if not artifact["has_tests"]:
        reasons.append("missing tests")
    if artifact["implementation_status"] in {"none", "plan", "schema_only"}:
        reasons.append(f"implementation is {artifact['implementation_status']}")
    if artifact["missingness"]:
        reasons.append("declared missingness: " + ", ".join(artifact["missingness"]))

    return score, reasons


def next_action_for(reasons: Iterable[str]) -> str:
    joined = " | ".join(reasons)
    if "missing synthetic fixture" in joined:
        return "Create a public-safe synthetic fixture corpus for this rung."
    if "missing validator" in joined:
        return "Implement a deterministic validator for this rung."
    if "missing tests" in joined:
        return "Add regression tests that fail on malformed public-safe fixtures."
    if "schema_only" in joined:
        return "Convert the schema into executable validation or generation code."
    return "Integrate this rung into the end-to-end discovery regression suite."


def score_manifest(manifest: Dict[str, Any]) -> List[RungScore]:
    by_rung: Dict[int, List[Dict[str, Any]]] = {rung: [] for rung in RUNG_NAMES}
    for artifact in manifest["artifacts"]:
        by_rung[artifact["rung"]].append(artifact)

    rung_scores: List[RungScore] = []
    for rung, artifacts in by_rung.items():
        if not artifacts:
            rung_scores.append(
                RungScore(
                    rung=rung,
                    name=RUNG_NAMES[rung],
                    score=0.0,
                    artifact_count=0,
                    reasons=["no artifacts declared for rung"],
                    next_executable_action="Create the first public-safe artifact for this rung.",
                )
            )
            continue

        artifact_scores = [artifact_score(artifact) for artifact in artifacts]
        avg_score = round(sum(score for score, _ in artifact_scores) / len(artifact_scores), 4)
        reasons: List[str] = []
        for _, artifact_reasons in artifact_scores:
            reasons.extend(artifact_reasons)
        unique_reasons = sorted(set(reasons))

        rung_scores.append(
            RungScore(
                rung=rung,
                name=RUNG_NAMES[rung],
                score=avg_score,
                artifact_count=len(artifacts),
                reasons=unique_reasons,
                next_executable_action=next_action_for(unique_reasons),
            )
        )

    return rung_scores


def build_report(manifest: Dict[str, Any]) -> Dict[str, Any]:
    scores = score_manifest(manifest)
    weakest = min(scores, key=lambda item: (item.score, item.rung))
    return {
        "schema_version": "1.0",
        "report_type": "discovery_ladder_audit_report",
        "source_status": "synthetic",
        "claim_status": "evaluation_report",
        "privacy_status": "public",
        "weakest_rung": {
            "rung": weakest.rung,
            "name": weakest.name,
            "score": weakest.score,
            "artifact_count": weakest.artifact_count,
            "reasons": weakest.reasons,
            "next_executable_action": weakest.next_executable_action,
        },
        "rung_scores": [score.__dict__ for score in scores],
    }


def main(argv: List[str]) -> int:
    if len(argv) != 3:
        print("usage: discovery_ladder_audit.py <fixtures.synthetic.json> <report.json>", file=sys.stderr)
        return 2

    manifest_path = Path(argv[1])
    report_path = Path(argv[2])
    manifest = load_manifest(manifest_path)
    errors = validate_manifest(manifest)
    if errors:
        print(json.dumps({"valid": False, "errors": errors}, indent=2, sort_keys=True), file=sys.stderr)
        return 1

    report = build_report(manifest)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
