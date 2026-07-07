#!/usr/bin/env python3
"""Mirror Cartographer retrieval boundary checker.

Public-safe executable gate for deciding whether retrieved packets can be reused.
It does not provide medical or veterinary advice. It only routes packets by
source, claim, privacy, missingness, and retrieval context labels.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

SAFE_SOURCE_STATUSES = {"synthetic", "public", "private_redacted"}
REVIEW_SOURCE_STATUSES = {"unknown"}
BLOCK_SOURCE_STATUSES = {"private_blocked"}

BLOCK_PRIVACY_STATUSES = {"private", "contains_identifier", "unknown"}
SAFE_PRIVACY_STATUSES = {"public_safe", "redacted"}

BLOCK_CLAIM_STATUSES = {"cure_claim", "action_guidance"}
KNOWN_CLAIM_STATUSES = {
    "observation",
    "hypothesis",
    "literature_note",
    "animal_care_note",
    "reviewed_evidence",
    "action_guidance",
    "cure_claim",
    "unknown",
}


def _is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def check_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    packet_id = packet.get("packet_id", "<missing_packet_id>")
    reasons: List[str] = []
    route = "allow_reuse"

    source_status = packet.get("source_status")
    claim_status = packet.get("claim_status")
    privacy_status = packet.get("privacy_status")
    missingness = packet.get("missingness", None)
    retrieval_context = packet.get("retrieval_context")

    if not _is_nonempty_string(packet.get("packet_id")):
        reasons.append("packet_id must be a stable public-safe string")
        route = "human_review"

    if source_status in BLOCK_SOURCE_STATUSES:
        reasons.append("source_status blocks reuse")
        route = "block"
    elif source_status in REVIEW_SOURCE_STATUSES or source_status not in SAFE_SOURCE_STATUSES:
        reasons.append("source_status is unknown or unsupported")
        if route != "block":
            route = "human_review"

    if privacy_status in BLOCK_PRIVACY_STATUSES or privacy_status not in SAFE_PRIVACY_STATUSES:
        reasons.append("privacy_status is unsafe or unknown")
        route = "block"

    if source_status == "private_redacted" and privacy_status not in {"redacted", "public_safe"}:
        reasons.append("private_redacted source requires redacted/public_safe privacy status")
        if route != "block":
            route = "redact_first"

    if claim_status not in KNOWN_CLAIM_STATUSES:
        reasons.append("claim_status is unsupported")
        if route != "block":
            route = "human_review"
    elif claim_status in BLOCK_CLAIM_STATUSES:
        reasons.append("claim_status is advice/cure-level and must not be reused without separate reviewed-evidence conversion")
        route = "block"
    elif claim_status == "unknown":
        reasons.append("claim_status is unknown")
        if route != "block":
            route = "human_review"

    if not isinstance(missingness, list):
        reasons.append("missingness must be explicitly present as an array")
        if route != "block":
            route = "human_review"

    if not isinstance(retrieval_context, dict):
        reasons.append("retrieval_context must be an object")
        if route != "block":
            route = "human_review"
    else:
        if not _is_nonempty_string(retrieval_context.get("requested_use")):
            reasons.append("retrieval_context.requested_use is required")
            if route != "block":
                route = "human_review"
        if not _is_nonempty_string(retrieval_context.get("retrieved_at")):
            reasons.append("retrieval_context.retrieved_at is required")
            if route != "block":
                route = "human_review"

    if not _is_nonempty_string(packet.get("revision_reason")):
        reasons.append("revision_reason is required")
        if route != "block":
            route = "human_review"

    next_action_by_route = {
        "allow_reuse": "reuse packet only inside its requested boundary and keep labels attached",
        "redact_first": "redact private residue, then rerun retrieval boundary checker",
        "human_review": "send packet to source/claim/missingness review before reuse",
        "block": "do not reuse; create a safer synthetic or reviewed replacement packet",
    }

    return {
        "packet_id": packet_id,
        "allowed": route == "allow_reuse",
        "route": route,
        "reasons": reasons,
        "next_executable_action": next_action_by_route[route],
    }


def check_packets(packets: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    results = [check_packet(packet) for packet in packets]
    exit_code = 1 if any(result["route"] == "block" for result in results) else 0
    return results, exit_code


def main(argv: List[str]) -> int:
    if len(argv) != 2:
        print("Usage: check_retrieval_boundaries.py <packets.json>", file=sys.stderr)
        return 2

    input_path = Path(argv[1])
    packets = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(packets, list):
        print("Input must be a JSON array of packet objects", file=sys.stderr)
        return 2

    results, exit_code = check_packets(packets)
    print(json.dumps(results, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
