#!/usr/bin/env python3
"""Regression tests for the Workflow Reconstruction Gate."""

from __future__ import annotations

import json
from pathlib import Path

from validate_workflow_reconstruction_packet import validate_packet

ROOT = Path(__file__).resolve().parent


def load_fixture(name: str) -> dict:
    return json.loads((ROOT / "fixtures" / name).read_text(encoding="utf-8"))


def test_valid_packet_passes() -> None:
    validate_packet(load_fixture("valid_packet.json"))


def test_invalid_packet_fails() -> None:
    try:
        validate_packet(load_fixture("invalid_packet.json"))
    except ValueError:
        return
    raise AssertionError("invalid packet unexpectedly passed validation")


def main() -> int:
    test_valid_packet_passes()
    test_invalid_packet_fails()
    print("workflow reconstruction gate tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
