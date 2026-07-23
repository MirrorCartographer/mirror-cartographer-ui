from __future__ import annotations

from adapter import CapabilityResult, finish, require

CAPABILITY = "ci-workers"


def verify(plan: dict) -> CapabilityResult:
    failures: list[str] = []
    evidence: list[str] = []

    require(plan.get("authority") == "foundation", "authority", failures)
    require(plan.get("provider") is None, "provider-binding", failures)

    control = plan.get("control_plane", {})
    require(control.get("implementation") == "forgejo-actions", "control-plane", failures)
    require(control.get("self_hosted") is True, "self-hosted-control-plane", failures)
    require(control.get("job_records_canonical") is True, "job-record-authority", failures)
    require(control.get("workflow_source_owned") is True, "workflow-source", failures)
    require(control.get("offline_export") is True, "offline-export", failures)

    runners = plan.get("runners", {})
    require(runners.get("ephemeral") is True, "ephemeral-runners", failures)
    require(runners.get("max_jobs_per_identity") == 1, "runner-reuse", failures)
    require(runners.get("host_execution") is False, "host-execution", failures)
    require(runners.get("isolation") in {"disposable-vm", "microvm"}, "isolation", failures)
    require(runners.get("rootless_container_engine") is True, "rootless-engine", failures)
    require(runners.get("privileged_containers") is False, "privileged-container", failures)
    require(runners.get("host_socket_mounted") is False, "host-socket", failures)
    require(runners.get("workspace_destroyed_after_job") is True, "workspace-destruction", failures)
    require(runners.get("network_default") == "deny", "network-default", failures)
    require(runners.get("resource_limits") is True, "resource-limits", failures)
    require(runners.get("timeout_seconds", 0) > 0, "timeout", failures)

    supply = plan.get("supply_chain", {})
    require(supply.get("images_by_digest") is True, "image-digests", failures)
    require(supply.get("actions_by_commit") is True, "action-pinning", failures)
    require(supply.get("internal_action_mirror") is True, "action-mirror", failures)
    require(supply.get("dependency_proxy_is_canonical") is False, "proxy-authority", failures)
    require(supply.get("build_output_to_owned_cas") is True, "artifact-custody", failures)

    secrets = plan.get("secrets", {})
    require(secrets.get("long_lived_on_runner") is False, "long-lived-secrets", failures)
    require(secrets.get("job_scoped_credentials") is True, "job-scoped-credentials", failures)
    require(secrets.get("release_key_available_to_pr_jobs") is False, "release-key-exposure", failures)
    require(secrets.get("fork_jobs_receive_secrets") is False, "fork-secret-exposure", failures)

    recovery = plan.get("recovery", {})
    for drill in (
        "runner_compromise",
        "runner_loss",
        "control_plane_restore",
        "queue_replay",
        "artifact_reconciliation",
        "second_operator",
    ):
        require(recovery.get(drill) == "pass", drill, failures)

    if not failures:
        evidence.extend([
            "self-hosted Forgejo Actions job authority",
            "single-job disposable runner identities",
            "VM boundary around rootless job containers",
            "digest-pinned actions and images",
            "job-scoped credentials with release-key separation",
            "owned artifact CAS and restorable job records",
        ])
    return finish(CAPABILITY, evidence, failures)
