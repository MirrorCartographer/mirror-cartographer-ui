#!/usr/bin/env python3
"""
Privacy Memory Handle Builder for Mirror Cartographer.

Converts public-safe research/observation packets into deterministic memory handles
without carrying raw private residue forward.

This is not medical or veterinary advice. It is a privacy and routing component.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ALLOWED_SOURCE_STATUS = {"synthetic", "public", "redacted_public_safe"}
ALLOWED_CLAIM_STATUS = {
    "observation_only",
    "hypothesis_seed",
    "measurement_definition",
    "review_note",
}
RETAINED_FIELDS = ("species_scope", "domain", "phenomenon", "time_bucket")

IDENTIFIER_PATTERNS: Tuple[Tuple[str, re.Pattern[str]], ...] = (
    ("email_like_identifier", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
    ("phone_like_identifier", re.compile(r"(?:\+?\d[\d .()\-]{7,}\d)")),
    ("full_date_identifier", re.compile(r"\b\d{4}-\d{2}-\d{2}\b")),
    ("street_address_like_identifier", re.compile(r"\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct)\b", re.I)),
)


def normalize_text(value: Any) -> str:
    """Normalize retained field values before hashing."""
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def detect_identifier_residue(values: Iterable[Any]) -> List[str]:
    """Return identifier-residue labels detected in retained field values."""
    joined = " | ".join(str(v) for v in values if v is not None)
    hits: List[str] = []
    for label, pattern in IDENTIFIER_PATTERNS:
        if pattern.search(joined):
            hits.append(label)
    return hits


def stable_memory_handle(retained_fields: Dict[str, str]) -> str:
    """Create a deterministic non-identifying handle from normalized retained fields."""
    canonical = json.dumps(retained_fields, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]
    return f"mc_mem_{digest}"


def validate_packet(packet: Dict[str, Any]) -> Tuple[List[str], Dict[str, str]]:
    """Validate one packet and return blocked reasons plus normalized retained fields."""
    reasons: List[str] = []

    if packet.get("privacy_status") != "public_safe":
        reasons.append("privacy_status_not_public_safe")

    if packet.get("claim_status") not in ALLOWED_CLAIM_STATUS:
        reasons.append("claim_status_not_memory_safe")

    if packet.get("source_status") not in ALLOWED_SOURCE_STATUS:
        reasons.append("source_status_not_allowed")

    if "missingness" not in packet:
        reasons.append("missingness_absent")
    elif not isinstance(packet.get("missingness"), list):
        reasons.append("missingness_not_array")

    retained = {field: normalize_text(packet.get(field, "")) for field in RETAINED_FIELDS}
    missing_retained = [field for field, value in retained.items() if not value]
    for field in missing_retained:
        reasons.append(f"retained_field_missing:{field}")

    for residue in detect_identifier_residue(retained.values()):
        reasons.append(residue)

    return reasons, retained


def build_handles(packets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build memory-handle routing output for all packets."""
    records: List[Dict[str, Any]] = []

    for packet in packets:
        packet_id = str(packet.get("packet_id", "missing_packet_id"))
        reasons, retained = validate_packet(packet)
        route = "memory_ready" if not reasons else "blocked_for_redaction"

        record: Dict[str, Any] = {
            "packet_id": packet_id,
            "memory_handle": stable_memory_handle(retained) if route == "memory_ready" else None,
            "route": route,
            "blocked_reasons": reasons,
            "retained_fields": retained if route == "memory_ready" else {},
            "labels": {
                "source_status": packet.get("source_status", "missing"),
                "claim_status": packet.get("claim_status", "missing"),
                "privacy_status": packet.get("privacy_status", "missing"),
                "missingness": packet.get("missingness", "missing"),
            },
        }
        records.append(record)

    return {
        "component": "privacy_memory_handle_builder",
        "implementation_status": "executable",
        "claim_status": "privacy_memory_routing_only_not_medical_or_veterinary_advice",
        "privacy_status": "public_safe_output_no_raw_private_notes",
        "records": records,
    }


def load_packets(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("input JSON must be an array of packets")
    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"packet at index {idx} must be an object")
    return data


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build public-safe deterministic memory handles.")
    parser.add_argument("input", type=Path, help="JSON array of public-safe candidate packets")
    parser.add_argument("--out", type=Path, help="Optional output JSON path")
    args = parser.parse_args(argv)

    try:
        result = build_handles(load_packets(args.input))
    except Exception as exc:  # pragma: no cover - CLI guard
        print(f"privacy_memory_handle_builder error: {exc}", file=sys.stderr)
        return 2

    rendered = json.dumps(result, indent=2, sort_keys=True)
    if args.out:
        args.out.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
