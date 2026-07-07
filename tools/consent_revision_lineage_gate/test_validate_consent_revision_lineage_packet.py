#!/usr/bin/env python3
"""Regression tests for Consent Revision Lineage packets."""

from __future__ import annotations

import json
from pathlib import Path

from validate_consent_revision_lineage_packet import validate_packet

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


def load_packet(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_valid_packet_passes() -> None:
    errors = validate_packet(load_packet("valid_consent_revision_lineage_packet.json"))
    assert errors == []


def test_invalid_packet_fails_revision_lineage() -> None:
    errors = validate_packet(load_packet("invalid_missing_revision_lineage_packet.json"))
    assert any("revision_lineage" in error for error in errors)


def main() -> int:
    test_valid_packet_passes()
    test_invalid_packet_fails_revision_lineage()
    print("PASS consent_revision_lineage_gate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
