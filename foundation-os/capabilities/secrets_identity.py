from __future__ import annotations

from adapter import CapabilityResult, finish, require

CAPABILITY = "secrets-identity"


def verify(plan: dict) -> CapabilityResult:
    failures: list[str] = []
    evidence: list[str] = []

    require(plan.get("authority") == "foundation", "authority", failures)
    require(plan.get("provider") is None, "provider-binding", failures)

    identity = plan.get("identity", {})
    require(identity.get("trust_domain") == "foundation.internal", "trust-domain", failures)
    require(identity.get("short_lived") is True, "long-lived-identity", failures)
    require(identity.get("provider_attestation_required") is False, "provider-attestation", failures)

    secrets = plan.get("secrets", {})
    require(secrets.get("static_machine_secrets") is False, "static-machine-secret", failures)
    require(secrets.get("lease_seconds", 10**18) <= 3600, "secret-lease", failures)
    require(secrets.get("offline_recovery") is True, "offline-recovery", failures)
    require(secrets.get("second_operator") is True, "single-operator", failures)

    if not failures:
        evidence.extend([
            "foundation trust-domain authority",
            "short-lived workload identity",
            "leased secret issuance",
            "provider-free recovery",
        ])
    return finish(CAPABILITY, evidence, failures)
