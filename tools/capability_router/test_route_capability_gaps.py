#!/usr/bin/env python3
"""Tests for the public-safe capability gap router."""

from __future__ import annotations

import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("route_capability_gaps.py")
spec = importlib.util.spec_from_file_location("route_capability_gaps", MODULE_PATH)
router = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(router)

FIXTURE_PATH = Path(__file__).with_name("fixtures.synthetic.json")


def _results_by_case():
    report = router.run_fixture(FIXTURE_PATH)
    return {item["case_id"]: item for item in report["results"]}


def test_expected_fixture_outcomes():
    report = router.run_fixture(FIXTURE_PATH)
    results = _results_by_case()

    assert report["privacy_status"] == "public"
    assert report["summary"]["total_cases"] == 5
    assert results["valid_prediction_needs_simulation"]["passed"] is True
    assert results["valid_prototype_needs_benchmark_and_implementation"]["passed"] is True
    assert results["invalid_missing_capabilities"]["passed"] is False
    assert results["invalid_duplicate_capability_ids"]["passed"] is False
    assert results["invalid_private_metadata"]["passed"] is False


def test_routes_are_priority_sorted_and_deterministic():
    first = router.run_fixture(FIXTURE_PATH)
    second = router.run_fixture(FIXTURE_PATH)
    assert first == second

    multi = _results_by_case()["valid_prototype_needs_benchmark_and_implementation"]
    route_ids = [item["capability_id"] for item in multi["routes"]]
    assert route_ids == ["cap_benchmark_001", "cap_implementation_001"]


def test_missing_capability_is_rejected():
    result = _results_by_case()["invalid_missing_capabilities"]
    assert "missing_required_capabilities" in result["errors"]


def test_duplicate_capability_ids_are_rejected():
    result = _results_by_case()["invalid_duplicate_capability_ids"]
    assert "duplicate_capability_id:cap_repeat" in result["errors"]


def test_private_metadata_is_rejected():
    result = _results_by_case()["invalid_private_metadata"]
    assert "non_public_metadata" in result["errors"]


if __name__ == "__main__":
    tests = [
        test_expected_fixture_outcomes,
        test_routes_are_priority_sorted_and_deterministic,
        test_missing_capability_is_rejected,
        test_duplicate_capability_ids_are_rejected,
        test_private_metadata_is_rejected,
    ]
    for test in tests:
        test()
    print("capability router tests passed")
