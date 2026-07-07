#!/usr/bin/env python3
"""Tests for the public-safe falsifiable prediction validator."""

from __future__ import annotations

import json
from pathlib import Path

from validate_falsifiable_prediction import validate_fixture_set, validate_prediction

FIXTURE_PATH = Path(__file__).with_name("fixtures.synthetic.json")


def load_fixture_set():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_fixture_expectations_match():
    report = validate_fixture_set(load_fixture_set())
    assert report["all_expectations_met"] is True
    assert report["valid_count"] == 2
    assert report["invalid_count"] == 4


def test_missing_metric_rejected():
    fixture_set = load_fixture_set()
    prediction = next(item for item in fixture_set["predictions"] if item["prediction_id"] == "prediction_invalid_missing_metric")
    valid, errors = validate_prediction(prediction, fixture_set["mechanism_registry"])
    assert valid is False
    assert any("observable_metric" in error for error in errors)


def test_unresolved_mechanism_rejected():
    fixture_set = load_fixture_set()
    prediction = next(item for item in fixture_set["predictions"] if item["prediction_id"] == "prediction_invalid_unresolved_mechanism")
    valid, errors = validate_prediction(prediction, fixture_set["mechanism_registry"])
    assert valid is False
    assert any("unresolved mechanism reference" in error for error in errors)


def test_identical_outcomes_rejected():
    fixture_set = load_fixture_set()
    prediction = next(item for item in fixture_set["predictions"] if item["prediction_id"] == "prediction_invalid_identical_outcomes")
    valid, errors = validate_prediction(prediction, fixture_set["mechanism_registry"])
    assert valid is False
    assert any("must differ" in error for error in errors)


def test_private_marker_rejected():
    fixture_set = load_fixture_set()
    prediction = next(item for item in fixture_set["predictions"] if item["prediction_id"] == "prediction_invalid_private_marker")
    valid, errors = validate_prediction(prediction, fixture_set["mechanism_registry"])
    assert valid is False
    assert any("privacy_status" in error or "private" in error for error in errors)


def test_duplicate_prediction_ids_rejected():
    fixture_set = load_fixture_set()
    duplicate = dict(fixture_set["predictions"][0])
    fixture_set["predictions"].append(duplicate)
    report = validate_fixture_set(fixture_set)
    duplicate_results = [item for item in report["results"] if item["prediction_id"] == duplicate["prediction_id"]]
    assert any(any("duplicate prediction_id" in error for error in item["errors"]) for item in duplicate_results)


if __name__ == "__main__":
    test_fixture_expectations_match()
    test_missing_metric_rejected()
    test_unresolved_mechanism_rejected()
    test_identical_outcomes_rejected()
    test_private_marker_rejected()
    test_duplicate_prediction_ids_rejected()
    print("prediction validator tests passed")
