#!/usr/bin/env python3
"""Validate Counterfactual Intervention Gate packets.

This validator intentionally uses only the Python standard library so the gate
can run in minimal CI or local research-review environments.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REQUIRED = [
    "packet_id",
    "source_status",
    "claim_status",
    "privacy_status",
    "observed_association",
    "counterfactual_intervention",
    "expected_directional_change",
    "temporal_propagation_path",
    "immutable_or_nonactionable_variables",
    "proxy_endpoint",
    "durable_target_endpoint",
    "missingness",
    "confounding_risks",
    "revision_reason",
    "implementation_status",
    "evidence_strength",
    "falsification_route",
    "next_executable_action",
]

ENUMS = {
    "source_status": {"public_primary", "public_preprint", "public_institutional", "synthetic_fixture", "mixed_public"},
    "claim_status": {"hypothesis", "evaluation_criterion", "schema_requirement", "prototype_requirement", "collaborator_target", "opportunity_target"},
    "privacy_status": {"public_safe", "synthetic_only", "contains_sensitive_data_blocked", "requires_local_only_processing"},
    "implementation_status": {"proposed", "schema_only", "validator_tested", "integrated", "deprecated"},
    "evidence_strength": {"low", "moderate", "high"},
}

MIN_TEXT = {
    "packet_id": 8,
    "observed_association": 20,
    "counterfactual_intervention": 20,
    "expected_directional_change": 10,
    "proxy_endpoint": 10,
    "durable_target_endpoint": 10,
    "revision_reason": 15,
    "falsification_route": 20,
    "next_executable_action": 10,
}


def _fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


def validate(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED:
        if key not in packet:
            _fail(errors, f"missing required field: {key}")

    for key, allowed in ENUMS.items():
        if key in packet and packet[key] not in allowed:
            _fail(errors, f"{key} must be one of {sorted(allowed)}")

    for key, minimum in MIN_TEXT.items():
        value = packet.get(key)
        if not isinstance(value, str) or len(value.strip()) < minimum:
            _fail(errors, f"{key} must be text with at least {minimum} characters")

    path = packet.get("temporal_propagation_path")
    if not isinstance(path, list) or len(path) < 2 or not all(isinstance(x, str) and len(x.strip()) >= 3 for x in path):
        _fail(errors, "temporal_propagation_path must contain at least two meaningful steps")

    immutable = packet.get("immutable_or_nonactionable_variables")
    if not isinstance(immutable, list) or len(immutable) < 1 or not all(isinstance(x, str) and len(x.strip()) >= 3 for x in immutable):
        _fail(errors, "immutable_or_nonactionable_variables must list at least one non-actionable variable")

    confounders = packet.get("confounding_risks")
    if not isinstance(confounders, list) or len(confounders) < 1 or not all(isinstance(x, str) and len(x.strip()) >= 3 for x in confounders):
        _fail(errors, "confounding_risks must list at least one confounder")

    missingness = packet.get("missingness")
    if not isinstance(missingness, dict):
        _fail(errors, "missingness must be an object")
    else:
        for subkey in ["known_gaps", "unknown_gaps", "sampling_irregularity", "modality_gaps"]:
            if subkey not in missingness:
                _fail(errors, f"missingness.{subkey} is required")
        if not isinstance(missingness.get("known_gaps"), list):
            _fail(errors, "missingness.known_gaps must be a list")
        if not isinstance(missingness.get("unknown_gaps"), list):
            _fail(errors, "missingness.unknown_gaps must be a list")
        if not isinstance(missingness.get("modality_gaps"), list):
            _fail(errors, "missingness.modality_gaps must be a list")
        if not isinstance(missingness.get("sampling_irregularity"), str) or len(missingness.get("sampling_irregularity", "").strip()) < 3:
            _fail(errors, "missingness.sampling_irregularity must be meaningful text")

    if packet.get("proxy_endpoint") == packet.get("durable_target_endpoint"):
        _fail(errors, "proxy_endpoint and durable_target_endpoint must be separated")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_counterfactual_intervention_packet.py <packet.json>", file=sys.stderr)
        return 2

    path = Path(argv[1])
    packet = json.loads(path.read_text(encoding="utf-8"))
    errors = validate(packet)
    if errors:
        print("INVALID")
        for error in errors:
            print(f"- {error}")
        return 1
    print("VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
