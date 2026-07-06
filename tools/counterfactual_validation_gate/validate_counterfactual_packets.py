#!/usr/bin/env python3
"""Validate Mirror Cartographer counterfactual validation packets.

This gate is public-safe research infrastructure. It rejects medical/veterinary
advice leakage and private raw-data packets; it does not diagnose, treat, or
recommend care.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REJECT_PRIVACY = {"sensitive_private_rejected", "unknown"}
ADVICE_TERMS = {
    "diagnose",
    "treat",
    "cure this patient",
    "give medication",
    "dose",
    "prescribe",
    "veterinary advice",
    "medical advice",
}


def _text_blob(packet: dict[str, Any]) -> str:
    return json.dumps(packet, sort_keys=True).lower()


def validate_packet(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    required = [
        "packet_id",
        "claim",
        "source_status",
        "claim_status",
        "privacy_status",
        "domain",
        "evidence_items",
        "measurable_variables",
        "counterfactuals",
        "decision_boundary",
        "missingness",
        "revision_reason",
        "implementation_status",
        "evidence_strength",
        "falsification_route",
        "next_executable_action",
    ]
    for key in required:
        if key not in packet:
            errors.append(f"missing required field: {key}")

    if errors:
        return errors

    if packet["privacy_status"] in REJECT_PRIVACY:
        errors.append(f"privacy_status rejected: {packet['privacy_status']}")

    if len(packet.get("evidence_items", [])) < 2:
        errors.append("requires at least two evidence_items")

    if len(packet.get("measurable_variables", [])) < 2:
        errors.append("requires at least two measurable_variables")

    if len(packet.get("counterfactuals", [])) < 2:
        errors.append("requires at least two counterfactuals")

    boundary = packet.get("decision_boundary", {})
    for key in ("promote_if", "hold_if", "reject_if"):
        if not isinstance(boundary, dict) or not boundary.get(key):
            errors.append(f"decision_boundary missing {key}")

    if len(str(packet.get("falsification_route", ""))) < 15:
        errors.append("falsification_route too short or absent")

    blob = _text_blob(packet)
    for term in ADVICE_TERMS:
        if term in blob and packet["claim_status"] != "evaluation_criterion":
            errors.append(f"advice-like term requires review: {term}")

    return errors


def validate_packets(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    packets = data if isinstance(data, list) else [data]
    failures = 0
    for packet in packets:
        errors = validate_packet(packet)
        status = "PASS" if not errors else "FAIL"
        print(f"{status} {packet.get('packet_id', '<missing-id>')}")
        for error in errors:
            print(f"  - {error}")
        if errors:
            failures += 1
    return failures


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_counterfactual_packets.py <packet-or-fixture.json>", file=sys.stderr)
        return 2
    failures = validate_packets(Path(argv[1]))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
