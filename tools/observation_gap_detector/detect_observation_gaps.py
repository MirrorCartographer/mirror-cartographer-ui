#!/usr/bin/env python3
"""Public-safe observation gap detector for Mirror Cartographer."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


def parse_time(value: Any) -> Tuple[datetime | None, str | None]:
    if not isinstance(value, str) or not value:
        return None, "missing_timestamp"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc), None
    except ValueError:
        return None, "bad_timestamp"


def detect_observation_gaps(packet: Dict[str, Any]) -> Dict[str, Any]:
    missingness: List[str] = []
    review: List[str] = []
    block: List[str] = []

    stream_id = packet.get("stream_id", "unknown_stream")
    privacy_status = packet.get("privacy_status", "unknown")
    claim_status = packet.get("claim_status", "unknown")
    measurement_status = packet.get("measurement_definition_status", "missing")
    observations = packet.get("observations", [])

    if privacy_status != "public_safe":
        block.append("privacy_not_public_safe")
    if measurement_status == "missing":
        block.append("measurement_definition_missing")
    elif measurement_status == "partial":
        review.append("measurement_definition_partial")
    if not isinstance(observations, list):
        block.append("observations_not_array")
        observations = []
    if len(observations) < 2:
        review.append("fewer_than_two_observations")

    parsed_times: List[datetime] = []
    source_statuses: List[str] = []

    for index, obs in enumerate(observations):
        if not isinstance(obs, dict):
            review.append(f"observation_{index}_not_object")
            continue
        parsed, error = parse_time(obs.get("timestamp"))
        if error:
            review.append(f"observation_{index}_{error}")
            missingness.append(f"observation_{index}_timestamp")
        else:
            parsed_times.append(parsed)
        if not obs.get("measure_id"):
            review.append(f"observation_{index}_missing_measure_id")
            missingness.append(f"observation_{index}_measure_id")
        if "missingness" not in obs or not isinstance(obs.get("missingness"), list):
            review.append(f"observation_{index}_missing_missingness_array")
            missingness.append(f"observation_{index}_missingness_array")
        else:
            missingness.extend(str(item) for item in obs.get("missingness", []))
        source_statuses.append(str(obs.get("source_status", "unknown")))

    expected = float(packet.get("expected_interval_hours", 24))
    multiplier = float(packet.get("max_gap_multiplier", 2))
    allowed_gap = expected * multiplier
    gap_count = 0
    longest_gap_hours = 0.0

    for earlier, later in zip(sorted(parsed_times), sorted(parsed_times)[1:]):
        gap_hours = (later - earlier).total_seconds() / 3600.0
        longest_gap_hours = max(longest_gap_hours, gap_hours)
        if gap_hours > allowed_gap:
            gap_count += 1
    if gap_count:
        review.append("excessive_observation_gap_detected")

    route = "block" if block else "review" if review else "pass"
    unique_sources = sorted(set(source_statuses)) or ["unknown"]
    source_status = unique_sources[0] if len(unique_sources) == 1 else "mixed"

    return {
        "stream_id": stream_id,
        "route": route,
        "gap_count": gap_count,
        "longest_gap_hours": round(longest_gap_hours, 3),
        "missingness": sorted(set(missingness)),
        "revision_reason": "; ".join(block + review) or "no_revision_needed",
        "block_reasons": block,
        "review_reasons": review,
        "labels": {
            "source_status": source_status,
            "claim_status": claim_status,
            "privacy_status": privacy_status,
            "missingness": "explicit",
            "revision_reason": "longitudinal_gap_detection",
            "implementation_status": "executable",
            "testability": "python tools/observation_gap_detector/test_detect_observation_gaps.py"
        },
        "next_executable_action": {
            "pass": "send_to_effect_window_comparator",
            "review": "repair_missingness_or_sampling_before_comparison",
            "block": "redact_or_redefine_before_reuse"
        }[route]
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_json")
    args = parser.parse_args()
    data = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
    if isinstance(data, list):
        result = [detect_observation_gaps(item.get("input", item)) for item in data]
    else:
        result = detect_observation_gaps(data)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
