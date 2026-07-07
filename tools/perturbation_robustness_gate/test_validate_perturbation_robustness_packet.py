#!/usr/bin/env python3
"""Regression tests for the Perturbation Robustness Gate."""

from __future__ import annotations

import json
from pathlib import Path

from validate_perturbation_robustness_packet import validate

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_valid_packet_passes() -> None:
    packet = load_fixture("valid_perturbation_robustness_packet.json")
    assert validate(packet) == []


def test_invalid_packet_fails() -> None:
    packet = load_fixture("invalid_perturbation_robustness_packet.json")
    errors = validate(packet)
    assert errors
    assert any("claim_survived_perturbation cannot be true" in error for error in errors)
    assert any("unknown privacy status blocks promotion" in error for error in errors)


def test_failed_robustness_cannot_survive() -> None:
    packet = load_fixture("valid_perturbation_robustness_packet.json")
    packet["robustness_result"] = "failed"
    packet["claim_survived_perturbation"] = True
    errors = validate(packet)
    assert any("claim_survived_perturbation cannot be true" in error for error in errors)


if __name__ == "__main__":
    test_valid_packet_passes()
    test_invalid_packet_fails()
    test_failed_robustness_cannot_survive()
    print("All perturbation robustness gate tests passed")
