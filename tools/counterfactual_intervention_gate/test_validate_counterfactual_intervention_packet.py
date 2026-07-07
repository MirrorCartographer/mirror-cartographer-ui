#!/usr/bin/env python3
"""Regression tests for the Counterfactual Intervention Gate."""

from __future__ import annotations

import json
from pathlib import Path

from validate_counterfactual_intervention_packet import validate

ROOT = Path(__file__).resolve().parent


def load_fixture(name: str):
    return json.loads((ROOT / "fixtures" / name).read_text(encoding="utf-8"))


def test_valid_packet_passes():
    errors = validate(load_fixture("valid_counterfactual_intervention_packet.json"))
    assert errors == []


def test_invalid_packet_fails():
    errors = validate(load_fixture("invalid_counterfactual_intervention_packet.json"))
    assert errors
    assert any("observed_association" in error for error in errors)
    assert any("temporal_propagation_path" in error for error in errors)
    assert any("immutable_or_nonactionable_variables" in error for error in errors)
    assert any("confounding_risks" in error for error in errors)


if __name__ == "__main__":
    test_valid_packet_passes()
    test_invalid_packet_fails()
    print("counterfactual intervention gate tests passed")
