#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED_AUTHORITIES = ("schedule", "retention", "restore_acceptance")
REQUIRED_GATES = (
    "backup_requires_restore",
    "production_cannot_modify_every_copy",
    "single_account_cannot_modify_every_copy",
    "digest_verification_required",
    "provider_replacement_restore_required",
    "second_operator_required",
    "quarterly_full_restore_required",
)
REQUIRED_CLASSES = {"postgres", "artifacts", "configuration"}


def validate(policy: dict) -> list[str]:
    failures: list[str] = []
    if policy.get("schema") != "foundation.backup-restore-policy.v1":
        failures.append("schema")

    authority = policy.get("authority", {})
    for field in REQUIRED_AUTHORITIES:
        if authority.get(field) != "foundation":
            failures.append(f"authority.{field}")
    if authority.get("external_storage_role") != "replaceable-replica":
        failures.append("authority.external_storage_role")

    objectives = policy.get("objectives", {})
    if not 0 < objectives.get("recovery_point_seconds", 0) <= 900:
        failures.append("objectives.recovery_point_seconds")
    if not 0 < objectives.get("recovery_time_seconds", 0) <= 14400:
        failures.append("objectives.recovery_time_seconds")
    if not 0 < objectives.get("maximum_unverified_age_seconds", 0) <= 86400:
        failures.append("objectives.maximum_unverified_age_seconds")

    copies = policy.get("copies", {})
    if copies.get("minimum", 0) < 3:
        failures.append("copies.minimum")
    if copies.get("failure_domains_minimum", 0) < 2:
        failures.append("copies.failure_domains_minimum")
    if copies.get("independent_write_boundary_minimum", 0) < 1:
        failures.append("copies.independent_write_boundary_minimum")
    if copies.get("sites_minimum", 0) < 2:
        failures.append("copies.sites_minimum")

    gates = policy.get("gates", {})
    for field in REQUIRED_GATES:
        if gates.get(field) is not True:
            failures.append(f"gates.{field}")

    classes = {item.get("id") for item in policy.get("data_classes", [])}
    if classes != REQUIRED_CLASSES:
        failures.append("data_classes")

    exits = set(policy.get("transport_exit_paths", []))
    if not {"filesystem", "sftp", "s3-compatible"}.issubset(exits):
        failures.append("transport_exit_paths")

    return failures


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate_backup_restore_policy.py POLICY.json", file=sys.stderr)
        return 2
    policy = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    failures = validate(policy)
    if failures:
        print("REJECT")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("ACCEPT")
    print(f"rpo={policy['objectives']['recovery_point_seconds']}")
    print(f"rto={policy['objectives']['recovery_time_seconds']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
