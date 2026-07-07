#!/usr/bin/env python3
"""Regression tests for validate_evidence_crosswalk.py."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from validate_evidence_crosswalk import validate_record

HERE = Path(__file__).resolve().parent


def load_fixtures():
    return json.loads((HERE / "fixtures.synthetic.json").read_text())["fixtures"]


def test_fixture_expectations():
    for fixture in load_fixtures():
        valid, errors, report = validate_record(fixture["record"])
        assert valid == fixture["expected_valid"], (fixture["name"], errors, report)


def test_valid_fixture_reports_support_and_constraint():
    fixture = load_fixtures()[0]["record"]
    valid, errors, report = validate_record(fixture)
    assert valid, errors
    assert report["alignment_counts"]["supports"] == 1
    assert report["alignment_counts"]["constrains"] == 1
    assert report["has_constraint"] is True


def test_rejects_duplicate_evidence_ids():
    fixture = copy.deepcopy(load_fixtures()[0]["record"])
    fixture["evidence_items"][1]["evidence_id"] = fixture["evidence_items"][0]["evidence_id"]
    valid, errors, _report = validate_record(fixture)
    assert not valid
    assert any("duplicate evidence_id" in error for error in errors)


def test_rejects_missing_falsification_route():
    fixture = copy.deepcopy(load_fixtures()[0]["record"])
    fixture["falsification_route"] = ""
    valid, errors, _report = validate_record(fixture)
    assert not valid
    assert "falsification_route is required" in errors


def test_rejects_unknown_alignment():
    fixture = copy.deepcopy(load_fixtures()[0]["record"])
    fixture["evidence_items"][0]["alignment"] = "proves"
    valid, errors, _report = validate_record(fixture)
    assert not valid
    assert any("alignment is not allowed" in error for error in errors)


if __name__ == "__main__":
    test_fixture_expectations()
    test_valid_fixture_reports_support_and_constraint()
    test_rejects_duplicate_evidence_ids()
    test_rejects_missing_falsification_route()
    test_rejects_unknown_alignment()
    print("evidence crosswalk tests passed")
