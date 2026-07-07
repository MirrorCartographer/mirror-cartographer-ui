#!/usr/bin/env python3
"""Tests for the public-safe discovery ladder audit harness."""

from __future__ import annotations

import copy
import json
import tempfile
from pathlib import Path

from discovery_ladder_audit import build_report, validate_manifest

FIXTURE_PATH = Path(__file__).with_name("fixtures.synthetic.json")


def load_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_fixture_is_valid():
    manifest = load_fixture()
    assert validate_manifest(manifest) == []


def test_weakest_rung_is_mechanistic_model():
    manifest = load_fixture()
    report = build_report(manifest)
    weakest = report["weakest_rung"]
    assert weakest["rung"] == 3
    assert weakest["name"] == "mechanistic model"
    assert "missing synthetic fixture" in weakest["reasons"]
    assert "missing validator" in weakest["reasons"]
    assert "missing tests" in weakest["reasons"]


def test_private_marker_rejected():
    manifest = load_fixture()
    manifest["artifacts"][0]["missingness"].append("private transcript required")
    errors = validate_manifest(manifest)
    assert any("blocked private marker" in error for error in errors)


def test_duplicate_artifact_id_rejected():
    manifest = load_fixture()
    manifest["artifacts"][1]["artifact_id"] = manifest["artifacts"][0]["artifact_id"]
    errors = validate_manifest(manifest)
    assert any("duplicate artifact_id" in error for error in errors)


def test_invalid_rung_rejected():
    manifest = load_fixture()
    manifest["artifacts"][0]["rung"] = 99
    errors = validate_manifest(manifest)
    assert any("invalid rung" in error for error in errors)


def test_missing_required_label_rejected():
    manifest = load_fixture()
    del manifest["claim_status"]
    errors = validate_manifest(manifest)
    assert any("missing top-level labels" in error for error in errors)


def test_report_is_deterministic():
    manifest = load_fixture()
    report_a = build_report(copy.deepcopy(manifest))
    report_b = build_report(copy.deepcopy(manifest))
    assert report_a == report_b


def run_all():
    tests = [
        test_fixture_is_valid,
        test_weakest_rung_is_mechanistic_model,
        test_private_marker_rejected,
        test_duplicate_artifact_id_rejected,
        test_invalid_rung_rejected,
        test_missing_required_label_rejected,
        test_report_is_deterministic,
    ]
    for test in tests:
        test()
    print(f"PASS {len(tests)} discovery ladder audit tests")


if __name__ == "__main__":
    run_all()
