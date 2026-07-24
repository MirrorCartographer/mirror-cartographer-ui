#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path


def validate(policy: dict) -> list[str]:
    failures: list[str] = []

    def require(condition: bool, name: str) -> None:
        if not condition:
            failures.append(name)

    require(policy.get("artifact_acceptance_authority") == "foundation", "artifact_acceptance_authority")
    require(policy.get("release_authority") == "foundation", "release_authority")
    require(policy.get("registry_role") == "distribution-only", "registry_role")
    require(policy.get("deployment_reference") == "digest-only", "deployment_reference")
    require(policy.get("tags_are_authoritative") is False, "tags_are_authoritative")
    require(policy.get("canonical_inventory_outside_registry") is True, "canonical_inventory_outside_registry")
    require(policy.get("portable_oci_layout_archive") is True, "portable_oci_layout_archive")
    require(policy.get("include_referrers") is True, "include_referrers")
    require(policy.get("replica_count", 0) >= 3, "replica_count")
    require(policy.get("failure_domain_count", 0) >= 2, "failure_domain_count")
    require(policy.get("independent_write_boundary") is True, "independent_write_boundary")
    require(0 < policy.get("credential_max_minutes", 0) <= 10, "credential_max_minutes")

    gc = policy.get("garbage_collection", {})
    for field in ("dry_run", "read_only", "verified_export", "post_collection_graph_audit"):
        require(gc.get(field) is True, f"garbage_collection.{field}")

    recovery = policy.get("recovery", {})
    for field in (
        "different_registry_implementation",
        "verify_manifest_digests",
        "verify_blob_digests",
        "verify_referrer_graph",
        "second_operator",
    ):
        require(recovery.get(field) is True, f"recovery.{field}")

    return failures


def self_test(policy: dict) -> int:
    cases = [("valid", policy, True)]
    mutations = [
        ("mutable-tags", "tags_are_authoritative", True),
        ("registry-release-authority", "release_authority", "registry"),
        ("two-replicas", "replica_count", 2),
        ("no-independent-boundary", "independent_write_boundary", False),
        ("no-referrers", "include_referrers", False),
        ("long-lived-credential", "credential_max_minutes", 1440),
    ]
    for name, field, value in mutations:
        candidate = copy.deepcopy(policy)
        candidate[field] = value
        cases.append((name, candidate, False))

    candidate = copy.deepcopy(policy)
    candidate["garbage_collection"]["read_only"] = False
    cases.append(("unsafe-garbage-collection", candidate, False))

    candidate = copy.deepcopy(policy)
    candidate["recovery"]["different_registry_implementation"] = False
    cases.append(("same-implementation-only", candidate, False))

    failed = False
    for name, candidate, expected_accept in cases:
        accepted = not validate(candidate)
        print(f"{name}: {'ACCEPT' if accepted else 'REJECT'}")
        failed |= accepted != expected_accept
    return 1 if failed else 0


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print("usage: validate_artifact_registry_policy.py POLICY.json [--self-test]", file=sys.stderr)
        return 2
    policy = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if len(sys.argv) == 3 and sys.argv[2] == "--self-test":
        return self_test(policy)
    failures = validate(policy)
    if failures:
        print("REJECT")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("ACCEPT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
