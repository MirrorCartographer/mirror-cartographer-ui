#!/usr/bin/env python3
"""Validate public-safe falsifiable prediction fixtures.

This validator is intentionally domain-neutral. It checks whether a prediction
is represented as an executable test contract rather than as a narrative claim.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ALLOWED_ARTIFACT_TYPES = {"mechanism", "interaction_mechanism_graph"}
ALLOWED_MEASUREMENT_TYPES = {"categorical", "continuous", "count", "boolean"}
ALLOWED_SOURCE_STATUS = {"synthetic", "public_literature", "public_benchmark"}
ALLOWED_CLAIM_STATUS = {"prediction_fixture", "infrastructure_test", "planning_artifact"}
PRIVATE_MARKERS = {"private", "personal", "household", "health", "animal-care", "financial", "location", "relationship", "credential", "raw transcript", "transcript"}

REQUIRED_FIELDS = [
    "prediction_id",
    "derived_from",
    "experimental_condition",
    "observable_metric",
    "predicted_outcome",
    "alternative_outcome",
    "falsification_condition",
    "minimum_required_data",
    "metadata",
]


def _text(value: Any) -> str:
    return str(value or "").strip()


def _contains_private_marker(value: Any) -> bool:
    haystack = json.dumps(value, sort_keys=True).lower()
    return any(marker in haystack for marker in PRIVATE_MARKERS)


def validate_prediction(prediction: Dict[str, Any], mechanism_registry: Iterable[str]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    registry = set(mechanism_registry)

    for field in REQUIRED_FIELDS:
        if field not in prediction:
            errors.append(f"missing required field: {field}")

    prediction_id = _text(prediction.get("prediction_id"))
    if not prediction_id:
        errors.append("prediction_id must be non-empty")

    derived_from = prediction.get("derived_from") or {}
    artifact_type = _text(derived_from.get("artifact_type"))
    artifact_id = _text(derived_from.get("artifact_id"))
    if artifact_type not in ALLOWED_ARTIFACT_TYPES:
        errors.append(f"invalid derived_from artifact_type: {artifact_type}")
    if not artifact_id:
        errors.append("derived_from artifact_id must be non-empty")
    elif artifact_id not in registry:
        errors.append(f"unresolved mechanism reference: {artifact_id}")

    if not _text(prediction.get("experimental_condition")):
        errors.append("experimental_condition must be non-empty")

    metric = prediction.get("observable_metric") or {}
    metric_name = _text(metric.get("name"))
    metric_type = _text(metric.get("measurement_type"))
    if not metric_name:
        errors.append("observable_metric.name must be non-empty")
    if metric_type not in ALLOWED_MEASUREMENT_TYPES:
        errors.append(f"invalid observable_metric.measurement_type: {metric_type}")

    predicted = _text(prediction.get("predicted_outcome"))
    alternative = _text(prediction.get("alternative_outcome"))
    if not predicted:
        errors.append("predicted_outcome must be non-empty")
    if not alternative:
        errors.append("alternative_outcome must be non-empty")
    if predicted and alternative and predicted.lower() == alternative.lower():
        errors.append("predicted_outcome and alternative_outcome must differ")

    if not _text(prediction.get("falsification_condition")):
        errors.append("falsification_condition must be non-empty")

    minimum_data = prediction.get("minimum_required_data") or {}
    replicates = minimum_data.get("replicates")
    if not isinstance(replicates, int) or replicates < 1:
        errors.append("minimum_required_data.replicates must be an integer >= 1")
    if not isinstance(minimum_data.get("controls_required"), bool):
        errors.append("minimum_required_data.controls_required must be boolean")

    metadata = prediction.get("metadata") or {}
    if metadata.get("privacy_status") != "public":
        errors.append("metadata.privacy_status must be public")
    if metadata.get("source_status") not in ALLOWED_SOURCE_STATUS:
        errors.append("metadata.source_status is invalid")
    if metadata.get("claim_status") not in ALLOWED_CLAIM_STATUS:
        errors.append("metadata.claim_status is invalid")
    if _contains_private_marker(prediction):
        errors.append("private or transcript-derived marker detected")

    return not errors, errors


def validate_fixture_set(fixture_set: Dict[str, Any]) -> Dict[str, Any]:
    predictions = fixture_set.get("predictions", [])
    mechanism_registry = fixture_set.get("mechanism_registry", [])
    seen_ids = set()
    duplicate_ids = set()
    results = []

    for prediction in predictions:
        prediction_id = prediction.get("prediction_id")
        if prediction_id in seen_ids:
            duplicate_ids.add(prediction_id)
        seen_ids.add(prediction_id)

    for prediction in predictions:
        valid, errors = validate_prediction(prediction, mechanism_registry)
        if prediction.get("prediction_id") in duplicate_ids:
            valid = False
            errors.append(f"duplicate prediction_id: {prediction.get('prediction_id')}")
        expected_valid = prediction.get("expected_valid")
        results.append(
            {
                "prediction_id": prediction.get("prediction_id"),
                "valid": valid,
                "expected_valid": expected_valid,
                "matches_expected": expected_valid is None or valid == expected_valid,
                "errors": errors,
            }
        )

    return {
        "fixture_set_id": fixture_set.get("fixture_set_id"),
        "valid_count": sum(1 for item in results if item["valid"]),
        "invalid_count": sum(1 for item in results if not item["valid"]),
        "all_expectations_met": all(item["matches_expected"] for item in results),
        "results": results,
    }


def main() -> int:
    fixture_path = Path(__file__).with_name("fixtures.synthetic.json")
    fixture_set = json.loads(fixture_path.read_text(encoding="utf-8"))
    report = validate_fixture_set(fixture_set)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["all_expectations_met"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
