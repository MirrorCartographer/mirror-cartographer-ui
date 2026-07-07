#!/usr/bin/env python3
"""Tests for observation gap detector."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODULE_PATH = ROOT / "detect_observation_gaps.py"
FIXTURE_PATH = ROOT / "fixtures.synthetic.json"

spec = importlib.util.spec_from_file_location("detect_observation_gaps", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


def test_fixture_routes() -> None:
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    for fixture in fixtures:
        result = module.detect_observation_gaps(fixture["input"])
        assert result["route"] == fixture["expected_route"], fixture["name"]


def test_output_labels_are_complete() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))[0]
    result = module.detect_observation_gaps(fixture["input"])
    labels = result["labels"]
    required = {
        "source_status",
        "claim_status",
        "privacy_status",
        "missingness",
        "revision_reason",
        "implementation_status",
        "testability",
    }
    assert required.issubset(labels.keys())
    assert result["next_executable_action"]


def test_gap_math() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))[2]
    result = module.detect_observation_gaps(fixture["input"])
    assert result["gap_count"] == 1
    assert result["longest_gap_hours"] == 96.0


def test_privacy_blocks_even_if_stream_has_data() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))[1]
    result = module.detect_observation_gaps(fixture["input"])
    assert result["route"] == "block"
    assert "privacy_not_public_safe" in result["block_reasons"]


def run_all() -> None:
    test_fixture_routes()
    test_output_labels_are_complete()
    test_gap_math()
    test_privacy_blocks_even_if_stream_has_data()
    print("observation_gap_detector tests passed")


if __name__ == "__main__":
    run_all()
