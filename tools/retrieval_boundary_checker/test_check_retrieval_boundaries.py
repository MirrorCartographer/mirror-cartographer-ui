#!/usr/bin/env python3
"""Tests for Mirror Cartographer retrieval boundary checker."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from check_retrieval_boundaries import check_packet, check_packets  # noqa: E402


def test_safe_packet_allowed() -> None:
    packet = {
        "packet_id": "safe_001",
        "source_status": "public",
        "claim_status": "observation",
        "privacy_status": "public_safe",
        "missingness": [],
        "revision_reason": "safe public fixture",
        "retrieval_context": {
            "requested_use": "longitudinal_pattern_tracking",
            "retrieved_at": "2026-07-07T00:00:00Z",
        },
        "content_summary": "Public-safe observation.",
    }
    result = check_packet(packet)
    assert result["allowed"] is True
    assert result["route"] == "allow_reuse"
    assert result["reasons"] == []


def test_private_identifier_blocked() -> None:
    packet = {
        "packet_id": "unsafe_001",
        "source_status": "private_redacted",
        "claim_status": "animal_care_note",
        "privacy_status": "contains_identifier",
        "missingness": [],
        "revision_reason": "unsafe fixture",
        "retrieval_context": {
            "requested_use": "collaborator_export",
            "retrieved_at": "2026-07-07T00:00:00Z",
        },
    }
    result = check_packet(packet)
    assert result["allowed"] is False
    assert result["route"] == "block"
    assert any("privacy_status" in reason for reason in result["reasons"])


def test_cure_claim_blocked() -> None:
    packet = {
        "packet_id": "overclaim_001",
        "source_status": "public",
        "claim_status": "cure_claim",
        "privacy_status": "public_safe",
        "missingness": [],
        "revision_reason": "overclaim fixture",
        "retrieval_context": {
            "requested_use": "claim_promotion",
            "retrieved_at": "2026-07-07T00:00:00Z",
        },
    }
    result = check_packet(packet)
    assert result["route"] == "block"
    assert any("advice/cure-level" in reason for reason in result["reasons"])


def test_unknown_source_reviewed() -> None:
    packet = {
        "packet_id": "review_001",
        "source_status": "unknown",
        "claim_status": "literature_note",
        "privacy_status": "public_safe",
        "missingness": [],
        "revision_reason": "review fixture",
        "retrieval_context": {
            "requested_use": "medical_literature_organization",
            "retrieved_at": "2026-07-07T00:00:00Z",
        },
    }
    result = check_packet(packet)
    assert result["allowed"] is False
    assert result["route"] == "human_review"


def test_missing_missingness_reviewed() -> None:
    packet = {
        "packet_id": "missingness_001",
        "source_status": "public",
        "claim_status": "hypothesis",
        "privacy_status": "public_safe",
        "revision_reason": "missingness fixture",
        "retrieval_context": {
            "requested_use": "falsification",
            "retrieved_at": "2026-07-07T00:00:00Z",
        },
    }
    result = check_packet(packet)
    assert result["route"] == "human_review"
    assert any("missingness" in reason for reason in result["reasons"])


def test_batch_exit_code_blocks_only_on_block() -> None:
    packets = [
        {
            "packet_id": "safe_002",
            "source_status": "synthetic",
            "claim_status": "observation",
            "privacy_status": "public_safe",
            "missingness": [],
            "revision_reason": "safe fixture",
            "retrieval_context": {"requested_use": "test", "retrieved_at": "2026-07-07T00:00:00Z"},
        },
        {
            "packet_id": "review_002",
            "source_status": "unknown",
            "claim_status": "observation",
            "privacy_status": "public_safe",
            "missingness": [],
            "revision_reason": "review fixture",
            "retrieval_context": {"requested_use": "test", "retrieved_at": "2026-07-07T00:00:00Z"},
        },
    ]
    _results, exit_code = check_packets(packets)
    assert exit_code == 0

    packets.append(
        {
            "packet_id": "block_002",
            "source_status": "public",
            "claim_status": "action_guidance",
            "privacy_status": "public_safe",
            "missingness": [],
            "revision_reason": "block fixture",
            "retrieval_context": {"requested_use": "test", "retrieved_at": "2026-07-07T00:00:00Z"},
        }
    )
    _results, exit_code = check_packets(packets)
    assert exit_code == 1


def test_cli_fixture_runs_and_blocks() -> None:
    proc = subprocess.run(
        [sys.executable, str(HERE / "check_retrieval_boundaries.py"), str(HERE / "fixtures.synthetic.json")],
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 1
    payload = json.loads(proc.stdout)
    routes = {item["packet_id"]: item["route"] for item in payload}
    assert routes["pkt_public_observation_001"] == "allow_reuse"
    assert routes["pkt_unknown_source_002"] == "human_review"
    assert routes["pkt_private_identifier_003"] == "block"
    assert routes["pkt_cure_claim_004"] == "block"
    assert routes["pkt_missingness_absent_005"] == "human_review"


if __name__ == "__main__":
    tests = [
        test_safe_packet_allowed,
        test_private_identifier_blocked,
        test_cure_claim_blocked,
        test_unknown_source_reviewed,
        test_missing_missingness_reviewed,
        test_batch_exit_code_blocks_only_on_block,
        test_cli_fixture_runs_and_blocks,
    ]
    for test in tests:
        test()
    print(f"ok - {len(tests)} retrieval boundary checker tests passed")
