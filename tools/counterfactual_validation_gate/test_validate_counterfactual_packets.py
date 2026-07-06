#!/usr/bin/env python3
"""Regression tests for the counterfactual validation gate."""

from __future__ import annotations

import json
from pathlib import Path

from validate_counterfactual_packets import validate_packet

FIXTURE_PATH = Path(__file__).with_name("fixtures.synthetic.json")


def load_fixtures():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_pass_fixture_accepts_counterfactual_packet():
    packet = next(p for p in load_fixtures() if p["packet_id"] == "cv-pass-001")
    assert validate_packet(packet) == []


def test_rejects_missing_counterfactuals():
    packet = next(p for p in load_fixtures() if p["packet_id"] == "cv-fail-no-counterfactuals")
    errors = validate_packet(packet)
    assert any("counterfactuals" in error for error in errors)
    assert any("evidence_items" in error for error in errors)


def test_rejects_private_advice_boundary():
    packet = next(p for p in load_fixtures() if p["packet_id"] == "cv-fail-private-advice")
    errors = validate_packet(packet)
    assert any("privacy_status rejected" in error for error in errors)
    assert any("advice-like" in error for error in errors)


if __name__ == "__main__":
    test_pass_fixture_accepts_counterfactual_packet()
    test_rejects_missing_counterfactuals()
    test_rejects_private_advice_boundary()
    print("counterfactual validation gate tests passed")
