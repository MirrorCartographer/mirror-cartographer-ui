#!/usr/bin/env python3
"""Regression tests for validate_interaction_graph.py."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from validate_interaction_graph import validate_fixture_set, validate_graph

HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures.synthetic.json"


def _fixture_graph(fixture_id: str):
    payload = json.loads(FIXTURES.read_text(encoding="utf-8"))
    for fixture in payload["fixtures"]:
        if fixture["fixture_id"] == fixture_id:
            return copy.deepcopy(fixture["graph"])
    raise AssertionError(f"missing fixture {fixture_id}")


def test_fixture_expectations_match():
    report = validate_fixture_set(FIXTURES)
    assert report["valid"], json.dumps(report, indent=2, sort_keys=True)
    assert report["fixture_count"] == 5
    assert report["failure_count"] == 0


def test_rejects_unknown_interaction_endpoint():
    graph = _fixture_graph("valid_enabling_chain")
    graph["interactions"][0]["target"] = "missing_node"
    report = validate_graph(graph)
    assert not report["valid"]
    assert any("unknown mechanism" in error for error in report["errors"])


def test_rejects_duplicate_mechanism_ids():
    graph = _fixture_graph("valid_competing_mechanisms")
    graph["mechanisms"][1]["mechanism_id"] = graph["mechanisms"][0]["mechanism_id"]
    report = validate_graph(graph)
    assert not report["valid"]
    assert any("duplicate mechanism" in error for error in report["errors"])


def test_rejects_missing_observables():
    graph = _fixture_graph("valid_enabling_chain")
    graph["observable_outputs"] = []
    report = validate_graph(graph)
    assert not report["valid"]
    assert any("observable_outputs" in error for error in report["errors"])


def test_rejects_private_marker_anywhere():
    graph = _fixture_graph("valid_enabling_chain")
    graph["mechanisms"][0]["description"] = "contains raw_transcript marker"
    report = validate_graph(graph)
    assert not report["valid"]
    assert any("private marker" in error for error in report["errors"])


def test_deterministic_metrics_for_identical_graphs():
    graph = _fixture_graph("valid_competing_mechanisms")
    first = validate_graph(graph)
    second = validate_graph(copy.deepcopy(graph))
    assert first == second
    assert first["metrics"]["node_count"] == 3
    assert first["metrics"]["interaction_count"] == 2


if __name__ == "__main__":
    test_fixture_expectations_match()
    test_rejects_unknown_interaction_endpoint()
    test_rejects_duplicate_mechanism_ids()
    test_rejects_missing_observables()
    test_rejects_private_marker_anywhere()
    test_deterministic_metrics_for_identical_graphs()
    print("mechanism graph validator tests passed")
