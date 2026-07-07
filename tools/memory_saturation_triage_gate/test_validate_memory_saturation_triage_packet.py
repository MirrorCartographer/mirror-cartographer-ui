#!/usr/bin/env python3
"""Regression tests for the Memory Saturation Triage Gate."""

from __future__ import annotations

import json
from pathlib import Path

from validate_memory_saturation_triage_packet import validate_packet

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_valid_packet_passes() -> None:
    validate_packet(load_fixture("valid_memory_saturation_triage_packet.json"))


def test_invalid_verbatim_high_risk_packet_fails() -> None:
    packet = load_fixture("invalid_verbatim_high_risk_packet.json")
    try:
        validate_packet(packet)
    except ValueError as exc:
        message = str(exc)
        assert "verbatim" in message or "sensitive" in message or "saturation" in message
        return
    raise AssertionError("invalid high-risk verbatim packet passed validation")


def test_medium_risk_verbatim_promotion_fails() -> None:
    packet = load_fixture("valid_memory_saturation_triage_packet.json")
    packet["triage_decision"] = {
        "decision": "promote",
        "storage_mode": "verbatim",
        "reason": "This intentionally unsafe mutation should fail because medium risk cannot be promoted verbatim."
    }
    try:
        validate_packet(packet)
    except ValueError as exc:
        assert "verbatim" in str(exc)
        return
    raise AssertionError("medium-risk verbatim promotion passed validation")


if __name__ == "__main__":
    test_valid_packet_passes()
    test_invalid_verbatim_high_risk_packet_fails()
    test_medium_risk_verbatim_promotion_fails()
    print("All Memory Saturation Triage Gate tests passed.")
