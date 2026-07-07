#!/usr/bin/env python3
"""Validate Consent Revision Lineage packets.

This validator is intentionally dependency-light. It checks required top-level
fields, nested required fields, enum-like values, and date shape. It does not
replace full jsonschema validation, but it is enough for CI-style regression
fixtures in the repository.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REQUIRED_TOP_LEVEL = [
    "packet_id",
    "source_status",
    "claim_status",
    "privacy_status",
    "subject_boundary",
    "consent_state",
    "revision_lineage",
    "deletion_or_redaction_route",
    "contextual_integrity_boundary",
    "privacy_loss_route",
    "missingness",
    "implementation_status",
    "evidence_strength",
    "falsification_route",
    "next_executable_action",
]

SOURCE_STATUS = {
    "primary_source",
    "research_institution",
    "preprint",
    "grant_or_prize",
    "dataset_or_benchmark",
    "open_source_tool",
    "synthetic_fixture",
    "mixed",
}
CLAIM_STATUS = {
    "hypothesis",
    "schema",
    "evaluation_criterion",
    "prototype_requirement",
    "source_map",
    "collaborator_target",
    "opportunity_target",
}
PRIVACY_STATUS = {
    "public_safe_synthetic",
    "deidentified_research",
    "private_sensitive_blocked",
    "requires_local_only_storage",
    "requires_user_consent",
}
IMPLEMENTATION_STATUS = {
    "planned",
    "implemented_schema",
    "implemented_test",
    "prototype_requirement",
    "needs_integration",
}
EVIDENCE_STRENGTH = {"weak", "moderate", "strong"}
SUBJECT_TYPES = {"person", "animal", "cohort", "species", "dataset", "model", "assay", "site", "synthetic"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def non_empty_string_list(value: Any) -> bool:
    return isinstance(value, list) and len(value) > 0 and all(non_empty_string(item) for item in value)


def validate_packet(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    for field in REQUIRED_TOP_LEVEL:
        require(field in packet, f"missing top-level field: {field}", errors)

    if errors:
        return errors

    require(non_empty_string(packet["packet_id"]) and len(packet["packet_id"]) >= 8, "packet_id must be a string of length >= 8", errors)
    require(packet["source_status"] in SOURCE_STATUS, "invalid source_status", errors)
    require(packet["claim_status"] in CLAIM_STATUS, "invalid claim_status", errors)
    require(packet["privacy_status"] in PRIVACY_STATUS, "invalid privacy_status", errors)
    require(packet["implementation_status"] in IMPLEMENTATION_STATUS, "invalid implementation_status", errors)
    require(packet["evidence_strength"] in EVIDENCE_STRENGTH, "invalid evidence_strength", errors)

    subject = packet["subject_boundary"]
    require(isinstance(subject, dict), "subject_boundary must be an object", errors)
    if isinstance(subject, dict):
        for field in ["subject_type", "species_or_population", "site_or_dataset", "modality", "transfer_limit"]:
            require(field in subject, f"missing subject_boundary.{field}", errors)
        if "subject_type" in subject:
            require(subject["subject_type"] in SUBJECT_TYPES, "invalid subject_boundary.subject_type", errors)
        for field in ["species_or_population", "site_or_dataset", "modality", "transfer_limit"]:
            if field in subject:
                require(non_empty_string(subject[field]), f"subject_boundary.{field} must be non-empty", errors)

    consent = packet["consent_state"]
    require(isinstance(consent, dict), "consent_state must be an object", errors)
    if isinstance(consent, dict):
        for field in ["allowed_operations", "blocked_operations", "reuse_scope", "consent_evidence", "expiration_or_review_trigger"]:
            require(field in consent, f"missing consent_state.{field}", errors)
        for field in ["allowed_operations", "blocked_operations"]:
            if field in consent:
                require(non_empty_string_list(consent[field]), f"consent_state.{field} must be a non-empty string list", errors)
        for field in ["reuse_scope", "consent_evidence", "expiration_or_review_trigger"]:
            if field in consent:
                require(non_empty_string(consent[field]), f"consent_state.{field} must be non-empty", errors)

    lineage = packet["revision_lineage"]
    require(isinstance(lineage, dict), "revision_lineage must be an object", errors)
    if isinstance(lineage, dict):
        for field in ["version", "prior_version", "evidence_cutoff", "revision_reason", "changed_fields", "unchanged_fields"]:
            require(field in lineage, f"missing revision_lineage.{field}", errors)
        for field in ["version", "prior_version", "revision_reason"]:
            if field in lineage:
                require(non_empty_string(lineage[field]), f"revision_lineage.{field} must be non-empty", errors)
        if "evidence_cutoff" in lineage:
            require(non_empty_string(lineage["evidence_cutoff"]) and bool(DATE_RE.match(lineage["evidence_cutoff"])), "revision_lineage.evidence_cutoff must be YYYY-MM-DD", errors)
        for field in ["changed_fields", "unchanged_fields"]:
            if field in lineage:
                require(non_empty_string_list(lineage[field]), f"revision_lineage.{field} must be a non-empty string list", errors)

    boundary = packet["contextual_integrity_boundary"]
    require(isinstance(boundary, dict), "contextual_integrity_boundary must be an object", errors)
    if isinstance(boundary, dict):
        for field in ["source_context", "destination_context", "allowed_transfer", "blocked_transfer"]:
            require(field in boundary, f"missing contextual_integrity_boundary.{field}", errors)
            if field in boundary:
                require(non_empty_string(boundary[field]), f"contextual_integrity_boundary.{field} must be non-empty", errors)

    for field in ["deletion_or_redaction_route", "privacy_loss_route", "falsification_route", "next_executable_action"]:
        require(non_empty_string(packet[field]), f"{field} must be non-empty", errors)
    require(non_empty_string_list(packet["missingness"]), "missingness must be a non-empty string list", errors)

    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_consent_revision_lineage_packet.py <packet.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    packet = json.loads(path.read_text(encoding="utf-8"))
    errors = validate_packet(packet)
    if errors:
        print("INVALID")
        for error in errors:
            print(f"- {error}")
        return 1
    print("VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
