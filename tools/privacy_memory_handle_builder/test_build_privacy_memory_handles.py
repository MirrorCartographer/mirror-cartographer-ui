#!/usr/bin/env python3
"""Tests for privacy_memory_handle_builder."""

from __future__ import annotations

import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("build_privacy_memory_handles.py")
spec = importlib.util.spec_from_file_location("build_privacy_memory_handles", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def test_ready_packet_gets_deterministic_handle() -> None:
    packet = {
        "packet_id": "obs-ready",
        "source_status": "synthetic",
        "claim_status": "observation_only",
        "privacy_status": "public_safe",
        "species_scope": "animal",
        "domain": "mobility",
        "phenomenon": "stiffness after travel",
        "time_bucket": "week_2026_07_01",
        "missingness": [],
    }
    first = module.build_handles([packet])["records"][0]
    second = module.build_handles([dict(packet)])["records"][0]
    assert first["route"] == "memory_ready"
    assert first["memory_handle"].startswith("mc_mem_")
    assert first["memory_handle"] == second["memory_handle"]


def test_private_packet_blocks() -> None:
    packet = {
        "packet_id": "obs-private",
        "source_status": "synthetic",
        "claim_status": "observation_only",
        "privacy_status": "private",
        "species_scope": "animal",
        "domain": "eye_health",
        "phenomenon": "pressure flare",
        "time_bucket": "week_2026_07_01",
        "missingness": [],
    }
    record = module.build_handles([packet])["records"][0]
    assert record["route"] == "blocked_for_redaction"
    assert record["memory_handle"] is None
    assert "privacy_status_not_public_safe" in record["blocked_reasons"]


def test_advice_claim_blocks() -> None:
    packet = {
        "packet_id": "obs-advice",
        "source_status": "synthetic",
        "claim_status": "medical_advice",
        "privacy_status": "public_safe",
        "species_scope": "animal",
        "domain": "medication",
        "phenomenon": "increase dose",
        "time_bucket": "week_2026_07_01",
        "missingness": [],
    }
    record = module.build_handles([packet])["records"][0]
    assert record["route"] == "blocked_for_redaction"
    assert "claim_status_not_memory_safe" in record["blocked_reasons"]


def test_identifier_residue_blocks() -> None:
    packet = {
        "packet_id": "obs-identifier",
        "source_status": "synthetic",
        "claim_status": "observation_only",
        "privacy_status": "public_safe",
        "species_scope": "animal",
        "domain": "contact_trace",
        "phenomenon": "emailed care@example.com on 2026-07-07",
        "time_bucket": "week_2026_07_01",
        "missingness": [],
    }
    record = module.build_handles([packet])["records"][0]
    assert record["route"] == "blocked_for_redaction"
    assert "email_like_identifier" in record["blocked_reasons"]
    assert "full_date_identifier" in record["blocked_reasons"]


def test_missingness_must_be_explicit_array() -> None:
    packet = {
        "packet_id": "obs-missingness",
        "source_status": "synthetic",
        "claim_status": "measurement_definition",
        "privacy_status": "public_safe",
        "species_scope": "animal",
        "domain": "appetite",
        "phenomenon": "meal completion percent",
        "time_bucket": "rolling_week",
    }
    record = module.build_handles([packet])["records"][0]
    assert record["route"] == "blocked_for_redaction"
    assert "missingness_absent" in record["blocked_reasons"]


def run_all() -> None:
    test_ready_packet_gets_deterministic_handle()
    test_private_packet_blocks()
    test_advice_claim_blocks()
    test_identifier_residue_blocks()
    test_missingness_must_be_explicit_array()


if __name__ == "__main__":
    run_all()
    print("privacy_memory_handle_builder tests passed")
