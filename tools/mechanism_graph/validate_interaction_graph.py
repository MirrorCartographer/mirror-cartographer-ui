#!/usr/bin/env python3
"""Validate public-safe interaction mechanism graph fixtures.

This validator is deliberately domain-neutral. It checks graph structure,
privacy boundaries, and deterministic summary metrics without making medical,
veterinary, scientific, or therapeutic claims.
"""

from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set, Tuple

ALLOWED_ROLES = {"driver", "modifier", "constraint", "observer"}
ALLOWED_INTERACTIONS = {
    "enables",
    "inhibits",
    "amplifies",
    "attenuates",
    "competes_with",
    "independent",
}
ALLOWED_CONFIDENCE = {"unknown", "low", "moderate", "high"}
REQUIRED_METADATA = {
    "source_status": "synthetic",
    "claim_status": "mechanistic_model",
    "privacy_status": "public",
}
PRIVATE_MARKERS = {
    "private_marker",
    "raw_transcript",
    "personal_health",
    "animal_care",
    "household",
    "financial",
    "credential",
    "relationship",
    "location_specific",
}


def _walk_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)


def _contains_private_marker(graph: Dict[str, Any]) -> bool:
    text = "\n".join(_walk_strings(graph)).lower()
    return any(marker in text for marker in PRIVATE_MARKERS)


def _component_count(nodes: Set[str], edges: List[Tuple[str, str]]) -> int:
    if not nodes:
        return 0
    adjacency = {node: set() for node in nodes}
    for source, target in edges:
        adjacency[source].add(target)
        adjacency[target].add(source)

    unseen = set(nodes)
    components = 0
    while unseen:
        components += 1
        start = unseen.pop()
        queue: deque[str] = deque([start])
        while queue:
            node = queue.popleft()
            for neighbor in adjacency[node]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    queue.append(neighbor)
    return components


def validate_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []

    if graph.get("schema_version") != "1.0":
        errors.append("schema_version must be 1.0")
    if graph.get("record_type") != "interaction_mechanism_graph":
        errors.append("record_type must be interaction_mechanism_graph")
    if not graph.get("graph_id"):
        errors.append("graph_id is required")

    metadata = graph.get("metadata", {})
    for key, expected in REQUIRED_METADATA.items():
        if metadata.get(key) != expected:
            errors.append(f"metadata.{key} must be {expected}")

    if _contains_private_marker(graph):
        errors.append("graph contains a prohibited private marker")

    mechanisms = graph.get("mechanisms", [])
    if not isinstance(mechanisms, list) or not mechanisms:
        errors.append("mechanisms must be a non-empty list")
        mechanisms = []

    mechanism_ids: List[str] = []
    for index, mechanism in enumerate(mechanisms):
        mechanism_id = mechanism.get("mechanism_id")
        if not mechanism_id:
            errors.append(f"mechanisms[{index}].mechanism_id is required")
        else:
            mechanism_ids.append(mechanism_id)
        if mechanism.get("role") not in ALLOWED_ROLES:
            errors.append(f"mechanisms[{index}].role is invalid")
        if not mechanism.get("description"):
            errors.append(f"mechanisms[{index}].description is required")

    duplicates = sorted({item for item in mechanism_ids if mechanism_ids.count(item) > 1})
    if duplicates:
        errors.append(f"duplicate mechanism identifiers: {duplicates}")

    node_set = set(mechanism_ids)
    interactions = graph.get("interactions", [])
    if not isinstance(interactions, list):
        errors.append("interactions must be a list")
        interactions = []

    edge_pairs: List[Tuple[str, str]] = []
    for index, interaction in enumerate(interactions):
        source = interaction.get("source")
        target = interaction.get("target")
        if source not in node_set:
            errors.append(f"interactions[{index}].source references an unknown mechanism")
        if target not in node_set:
            errors.append(f"interactions[{index}].target references an unknown mechanism")
        if source in node_set and target in node_set:
            edge_pairs.append((source, target))
        if interaction.get("interaction_type") not in ALLOWED_INTERACTIONS:
            errors.append(f"interactions[{index}].interaction_type is invalid")
        if interaction.get("confidence") not in ALLOWED_CONFIDENCE:
            errors.append(f"interactions[{index}].confidence is invalid")

    observable_outputs = graph.get("observable_outputs", [])
    if not isinstance(observable_outputs, list) or not observable_outputs:
        errors.append("observable_outputs must contain at least one measurable output")

    metrics = {
        "graph_id": graph.get("graph_id"),
        "node_count": len(node_set),
        "interaction_count": len(interactions),
        "observable_output_count": len(observable_outputs) if isinstance(observable_outputs, list) else 0,
        "connected_component_count": _component_count(node_set, edge_pairs),
    }

    return {
        "valid": not errors,
        "errors": sorted(errors),
        "metrics": metrics,
    }


def validate_fixture_set(path: Path) -> Dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    results = []
    failures = []

    for fixture in payload.get("fixtures", []):
        result = validate_graph(fixture.get("graph", {}))
        expected = fixture.get("expected_valid")
        observed = result["valid"]
        item = {
            "fixture_id": fixture.get("fixture_id"),
            "expected_valid": expected,
            "observed_valid": observed,
            "matches_expectation": expected == observed,
            "errors": result["errors"],
            "metrics": result["metrics"],
        }
        results.append(item)
        if not item["matches_expectation"]:
            failures.append(item)

    return {
        "valid": not failures,
        "fixture_count": len(results),
        "failure_count": len(failures),
        "results": results,
    }


def main(argv: List[str]) -> int:
    fixture_path = Path(argv[1]) if len(argv) > 1 else Path(__file__).with_name("fixtures.synthetic.json")
    report = validate_fixture_set(fixture_path)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
