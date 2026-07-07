#!/usr/bin/env python3
"""Validate a Workflow Reconstruction Packet fixture.

This intentionally uses only the Python standard library so the gate can run
in constrained environments without installing jsonschema.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REQUIRED_TOP_LEVEL = [
    "packet_id",
    "created_at",
    "source_status",
    "claim_status",
    "privacy_status",
    "missingness",
    "revision_reason",
    "implementation_status",
    "evidence_strength",
    "falsification_route",
    "next_executable_action",
    "claim",
    "workflow_trace",
    "boundaries",
    "human_checkpoint",
    "blocked_inferences",
    "source_map",
]

ENUMS = {
    "source_status": {"primary", "institutional", "preprint", "benchmark", "open_source", "policy_analysis", "mixed"},
    "claim_status": {"hypothesis", "test", "schema", "evaluation_criterion", "source_map", "prototype_requirement", "collaborator_target", "opportunity_target"},
    "privacy_status": {"public_safe", "synthetic_only", "deidentified", "sensitive_requires_review", "blocked_private_data"},
    "implementation_status": {"proposed", "implemented", "validated_synthetic", "validated_real_world", "deprecated"},
    "evidence_strength": {"low", "moderate", "high", "mixed"},
}

CLAIM_DOMAINS = {
    "scientific_ai",
    "medical_ai",
    "mechanistic_biology",
    "neuroscience",
    "longitudinal_health",
    "animal_health",
    "hci",
    "privacy_memory",
    "hypothesis_generation",
}

SOURCE_STATUSES = {"peer_reviewed", "preprint", "institutional", "benchmark", "policy_analysis", "open_source"}


def fail(message: str) -> None:
    raise ValueError(message)


def require_string(obj: dict[str, Any], key: str, min_len: int = 1) -> None:
    value = obj.get(key)
    if not isinstance(value, str) or len(value.strip()) < min_len:
        fail(f"{key} must be a string with length >= {min_len}")


def require_string_list(obj: dict[str, Any], key: str, min_items: int = 1) -> None:
    value = obj.get(key)
    if not isinstance(value, list) or len(value) < min_items:
        fail(f"{key} must be a list with at least {min_items} item(s)")
    for item in value:
        if not isinstance(item, str) or len(item.strip()) < 3:
            fail(f"{key} items must be meaningful strings")


def validate_packet(packet: dict[str, Any]) -> None:
    extra = set(packet) - set(REQUIRED_TOP_LEVEL)
    if extra:
        fail(f"unexpected top-level keys: {sorted(extra)}")

    for key in REQUIRED_TOP_LEVEL:
        if key not in packet:
            fail(f"missing required key: {key}")

    for key, allowed in ENUMS.items():
        if packet[key] not in allowed:
            fail(f"{key} has invalid value: {packet[key]!r}")

    require_string(packet, "packet_id", 8)
    require_string(packet, "created_at", 10)
    require_string(packet, "revision_reason", 20)
    require_string(packet, "falsification_route", 20)
    require_string(packet, "next_executable_action", 10)
    require_string_list(packet, "missingness", 1)
    require_string_list(packet, "blocked_inferences", 1)

    claim = packet["claim"]
    if not isinstance(claim, dict):
        fail("claim must be an object")
    for key in ["summary", "domain", "intended_use", "not_medical_or_veterinary_advice"]:
        if key not in claim:
            fail(f"claim missing {key}")
    require_string(claim, "summary", 20)
    require_string(claim, "intended_use", 10)
    if claim["not_medical_or_veterinary_advice"] is not True:
        fail("claim.not_medical_or_veterinary_advice must be true")
    if not isinstance(claim["domain"], list) or not claim["domain"]:
        fail("claim.domain must be a non-empty list")
    for domain in claim["domain"]:
        if domain not in CLAIM_DOMAINS:
            fail(f"invalid claim domain: {domain!r}")

    trace = packet["workflow_trace"]
    if not isinstance(trace, list) or len(trace) < 3:
        fail("workflow_trace must contain at least three reconstructable steps")
    seen_steps = []
    for step in trace:
        if not isinstance(step, dict):
            fail("workflow_trace items must be objects")
        for key in ["step", "input", "operation", "output", "audit_note"]:
            if key not in step:
                fail(f"workflow_trace item missing {key}")
        if not isinstance(step["step"], int) or step["step"] < 1:
            fail("workflow_trace.step must be a positive integer")
        seen_steps.append(step["step"])
        for key in ["input", "operation", "output"]:
            require_string(step, key, 3)
        require_string(step, "audit_note", 10)
    if seen_steps != sorted(seen_steps):
        fail("workflow_trace steps must be ordered")

    boundaries = packet["boundaries"]
    if not isinstance(boundaries, dict):
        fail("boundaries must be an object")
    for key in ["tool_boundary", "data_boundary", "model_boundary", "species_boundary", "temporal_boundary", "privacy_boundary"]:
        require_string(boundaries, key, 5)

    checkpoint = packet["human_checkpoint"]
    if not isinstance(checkpoint, dict):
        fail("human_checkpoint must be an object")
    if not isinstance(checkpoint.get("required"), bool):
        fail("human_checkpoint.required must be boolean")
    require_string(checkpoint, "who", 3)
    require_string(checkpoint, "checkpoint_reason", 10)

    source_map = packet["source_map"]
    if not isinstance(source_map, list) or len(source_map) < 2:
        fail("source_map must contain at least two sources")
    for source in source_map:
        if not isinstance(source, dict):
            fail("source_map entries must be objects")
        for key in ["title", "url", "status", "claim_supported", "caveat"]:
            if key not in source:
                fail(f"source_map entry missing {key}")
        require_string(source, "title", 3)
        require_string(source, "url", 10)
        if source["status"] not in SOURCE_STATUSES:
            fail(f"invalid source status: {source['status']!r}")
        require_string(source, "claim_supported", 10)
        require_string(source, "caveat", 5)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate_workflow_reconstruction_packet.py <packet.json>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    packet = json.loads(path.read_text(encoding="utf-8"))
    validate_packet(packet)
    print(f"VALID workflow reconstruction packet: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
