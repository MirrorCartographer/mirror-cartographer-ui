#!/usr/bin/env python3
"""Validate a Perturbation Robustness Packet.

This validator intentionally uses only the Python standard library so it can run in
restricted automation environments. It performs the subset of JSON Schema checks
needed by this gate and adds one semantic promotion check:

- packets with failed/inconclusive/not-yet-tested robustness cannot claim they
  survived perturbation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REQUIRED_FIELDS = {
    "packet_id",
    "schema_version",
    "domain",
    "hypothesis_or_task",
    "expected_output_artifact",
    "source_status",
    "claim_status",
    "privacy_status",
    "perturbation_class",
    "perturbation_description",
    "robustness_result",
    "claim_survived_perturbation",
    "missingness",
    "revision_reason",
    "implementation_status",
    "evidence_strength",
    "falsification_route",
    "next_executable_action",
}

ALLOWED_DOMAINS = {
    "scientific_ai",
    "medical_ai",
    "mechanistic_biology",
    "neuroscience",
    "longitudinal_health_data",
    "animal_health_research_infrastructure",
    "hci",
    "privacy_preserving_memory",
    "hypothesis_generation_system",
}

ALLOWED_SOURCE_STATUS = {
    "primary_source",
    "clinical_or_research_institution",
    "preprint_with_caveat",
    "benchmark_or_dataset",
    "open_source_tool",
    "synthetic_fixture",
}

ALLOWED_CLAIM_STATUS = {
    "research_organization",
    "hypothesis",
    "evaluation_criterion",
    "prototype_requirement",
    "not_medical_or_veterinary_advice",
}

ALLOWED_PRIVACY_STATUS = {
    "public_synthetic_only",
    "deidentified_research_allowed",
    "private_sensitive_blocked",
    "requires_local_only_execution",
    "unknown_block_promotion",
}

ALLOWED_PERTURBATIONS = {
    "corrupted_input",
    "decoy_file",
    "prompt_bloat",
    "platform_shift",
    "modality_shift",
    "missingness_shift",
    "negative_control",
    "dual_use_risk_route",
    "insufficient_data_case",
}

ALLOWED_RESULTS = {
    "passed",
    "failed",
    "inconclusive",
    "not_yet_tested_block_promotion",
}

ALLOWED_IMPLEMENTATION_STATUS = {
    "schema_only",
    "validator_added",
    "fixtures_added",
    "tests_added",
    "committed",
}

ALLOWED_EVIDENCE_STRENGTH = {"weak", "moderate", "strong", "unknown"}


def _require_text(packet: dict[str, Any], key: str, min_length: int, errors: list[str]) -> None:
    value = packet.get(key)
    if not isinstance(value, str) or len(value.strip()) < min_length:
        errors.append(f"{key} must be text with at least {min_length} characters")


def validate(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    extra = set(packet) - REQUIRED_FIELDS
    missing = REQUIRED_FIELDS - set(packet)
    if extra:
        errors.append(f"unexpected fields: {sorted(extra)}")
    if missing:
        errors.append(f"missing required fields: {sorted(missing)}")
        return errors

    if packet["schema_version"] != "1.0.0":
        errors.append("schema_version must be 1.0.0")

    enum_checks = [
        ("domain", ALLOWED_DOMAINS),
        ("source_status", ALLOWED_SOURCE_STATUS),
        ("claim_status", ALLOWED_CLAIM_STATUS),
        ("privacy_status", ALLOWED_PRIVACY_STATUS),
        ("perturbation_class", ALLOWED_PERTURBATIONS),
        ("robustness_result", ALLOWED_RESULTS),
        ("implementation_status", ALLOWED_IMPLEMENTATION_STATUS),
        ("evidence_strength", ALLOWED_EVIDENCE_STRENGTH),
    ]
    for key, allowed in enum_checks:
        if packet[key] not in allowed:
            errors.append(f"{key} has invalid value: {packet[key]!r}")

    for key, min_length in [
        ("packet_id", 8),
        ("hypothesis_or_task", 20),
        ("expected_output_artifact", 10),
        ("perturbation_description", 20),
        ("revision_reason", 20),
        ("falsification_route", 20),
        ("next_executable_action", 10),
    ]:
        _require_text(packet, key, min_length, errors)

    if not isinstance(packet["claim_survived_perturbation"], bool):
        errors.append("claim_survived_perturbation must be boolean")

    missingness = packet.get("missingness")
    if not isinstance(missingness, dict):
        errors.append("missingness must be an object")
    else:
        required_missingness = {"known_missing", "untested_conditions", "missingness_affects_claim"}
        if set(missingness) != required_missingness:
            errors.append("missingness must contain only known_missing, untested_conditions, missingness_affects_claim")
        for array_key in ["known_missing", "untested_conditions"]:
            values = missingness.get(array_key)
            if not isinstance(values, list) or not values or not all(isinstance(item, str) and len(item.strip()) >= 3 for item in values):
                errors.append(f"missingness.{array_key} must be a non-empty string list")
        if not isinstance(missingness.get("missingness_affects_claim"), bool):
            errors.append("missingness.missingness_affects_claim must be boolean")

    if packet["robustness_result"] != "passed" and packet["claim_survived_perturbation"]:
        errors.append("claim_survived_perturbation cannot be true unless robustness_result is passed")

    if packet["privacy_status"] == "unknown_block_promotion" and packet["robustness_result"] == "passed":
        errors.append("unknown privacy status blocks promotion even if robustness passed")

    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_perturbation_robustness_packet.py <packet.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
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
    raise SystemExit(main())
