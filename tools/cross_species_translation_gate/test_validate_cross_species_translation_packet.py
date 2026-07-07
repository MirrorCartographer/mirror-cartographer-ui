#!/usr/bin/env python3
"""Regression tests for the Cross Species Translation Gate validator."""

from __future__ import annotations

import json
from pathlib import Path

from validate_cross_species_translation_packet import ValidationError, validate_packet

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


def _load(name: str) -> dict:
    with (FIXTURES / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_valid_packet_passes() -> None:
    validate_packet(_load("valid_cross_species_translation_packet.json"))


def test_missing_bridge_packet_fails() -> None:
    try:
        validate_packet(_load("invalid_missing_bridge_packet.json"))
    except ValidationError as exc:
        assert "bridge_evidence" in str(exc)
    else:
        raise AssertionError("invalid_missing_bridge_packet.json unexpectedly passed")


def test_empty_blocked_inferences_fail() -> None:
    packet = _load("valid_cross_species_translation_packet.json")
    packet["blocked_inferences"] = []
    try:
        validate_packet(packet)
    except ValidationError as exc:
        assert "blocked_inferences" in str(exc)
    else:
        raise AssertionError("empty blocked_inferences unexpectedly passed")


def test_invalid_domain_type_fails() -> None:
    packet = _load("valid_cross_species_translation_packet.json")
    packet["target_domain"]["domain_type"] = "unsupported_domain"
    try:
        validate_packet(packet)
    except ValidationError as exc:
        assert "target_domain.domain_type" in str(exc)
    else:
        raise AssertionError("unsupported domain type unexpectedly passed")


if __name__ == "__main__":
    test_valid_packet_passes()
    test_missing_bridge_packet_fails()
    test_empty_blocked_inferences_fail()
    test_invalid_domain_type_fails()
    print("cross species translation gate tests passed")
