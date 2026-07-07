#!/usr/bin/env python3
"""Validate Cross Species Translation Gate packets.

The validator is intentionally dependency-light. It enforces the schema's required
fields, enum constraints, nested required fields, and non-empty list/string rules
without requiring jsonschema to be installed in the runtime.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "cross_species_translation.schema.json"


class ValidationError(Exception):
    """Raised when a packet fails validation."""


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _ensure_string(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be a non-empty string")


def _ensure_list(value: Any, field: str) -> None:
    if not isinstance(value, list) or not value:
        raise ValidationError(f"{field} must be a non-empty list")
    for index, item in enumerate(value):
        _ensure_string(item, f"{field}[{index}]")


def _ensure_enum(value: Any, allowed: list[str], field: str) -> None:
    if value not in allowed:
        raise ValidationError(f"{field} must be one of {allowed}; got {value!r}")


def _ensure_domain(value: Any, field: str) -> None:
    if not isinstance(value, dict):
        raise ValidationError(f"{field} must be an object")
    required = [
        "domain_type",
        "species_or_population",
        "site_or_dataset",
        "modality",
        "workflow_context",
        "endpoint_type",
    ]
    allowed_domain_types = [
        "human_clinical",
        "animal_health",
        "mechanistic_biology",
        "neuroscience",
        "longitudinal_memory",
        "synthetic_fixture",
        "software_benchmark",
    ]
    for key in required:
        if key not in value:
            raise ValidationError(f"{field}.{key} is required")
    _ensure_enum(value["domain_type"], allowed_domain_types, f"{field}.domain_type")
    for key in required[1:]:
        _ensure_string(value[key], f"{field}.{key}")


def _ensure_translation_boundary(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValidationError("translation_boundary must be an object")
    required = [
        "species_boundary",
        "site_boundary",
        "modality_boundary",
        "workflow_boundary",
        "endpoint_boundary",
        "consent_boundary",
        "privacy_boundary",
    ]
    for key in required:
        if key not in value:
            raise ValidationError(f"translation_boundary.{key} is required")
        _ensure_string(value[key], f"translation_boundary.{key}")


def validate_packet(packet: dict[str, Any]) -> None:
    schema = _load_json(SCHEMA_PATH)
    required = schema["required"]
    for field in required:
        if field not in packet:
            raise ValidationError(f"missing required field: {field}")

    allowed_top_level = set(schema["properties"].keys())
    extra = sorted(set(packet.keys()) - allowed_top_level)
    if extra:
        raise ValidationError(f"unexpected fields: {extra}")

    _ensure_string(packet["packet_id"], "packet_id")
    if len(packet["packet_id"]) < 8:
        raise ValidationError("packet_id must contain at least 8 characters")

    enum_fields = {
        "source_status": schema["properties"]["source_status"]["enum"],
        "claim_status": schema["properties"]["claim_status"]["enum"],
        "privacy_status": schema["properties"]["privacy_status"]["enum"],
        "implementation_status": schema["properties"]["implementation_status"]["enum"],
        "evidence_strength": schema["properties"]["evidence_strength"]["enum"],
    }
    for field, allowed in enum_fields.items():
        _ensure_enum(packet[field], allowed, field)

    _ensure_domain(packet["source_domain"], "source_domain")
    _ensure_domain(packet["target_domain"], "target_domain")
    _ensure_translation_boundary(packet["translation_boundary"])

    for field in ["bridge_evidence", "blocked_inferences", "missingness"]:
        _ensure_list(packet[field], field)

    for field in ["evaluation_criterion", "revision_reason", "falsification_route", "next_executable_action"]:
        _ensure_string(packet[field], field)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: validate_cross_species_translation_packet.py <packet.json>", file=sys.stderr)
        return 2

    packet_path = Path(argv[1])
    try:
        packet = _load_json(packet_path)
        validate_packet(packet)
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(f"INVALID: {packet_path}: {exc}", file=sys.stderr)
        return 1

    print(f"VALID: {packet_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
