from __future__ import annotations

import copy
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "capabilities"))

from ci_workers import verify  # noqa: E402


VALID = {
    "authority": "foundation",
    "provider": None,
    "control_plane": {
        "implementation": "forgejo-actions",
        "self_hosted": True,
        "job_records_canonical": True,
        "workflow_source_owned": True,
        "offline_export": True,
    },
    "runners": {
        "ephemeral": True,
        "max_jobs_per_identity": 1,
        "host_execution": False,
        "isolation": "disposable-vm",
        "rootless_container_engine": True,
        "privileged_containers": False,
        "host_socket_mounted": False,
        "workspace_destroyed_after_job": True,
        "network_default": "deny",
        "resource_limits": True,
        "timeout_seconds": 3600,
    },
    "supply_chain": {
        "images_by_digest": True,
        "actions_by_commit": True,
        "internal_action_mirror": True,
        "dependency_proxy_is_canonical": False,
        "build_output_to_owned_cas": True,
    },
    "secrets": {
        "long_lived_on_runner": False,
        "job_scoped_credentials": True,
        "release_key_available_to_pr_jobs": False,
        "fork_jobs_receive_secrets": False,
    },
    "recovery": {
        "runner_compromise": "pass",
        "runner_loss": "pass",
        "control_plane_restore": "pass",
        "queue_replay": "pass",
        "artifact_reconciliation": "pass",
        "second_operator": "pass",
    },
}


def rejected(mutator) -> None:
    plan = copy.deepcopy(VALID)
    mutator(plan)
    result = verify(plan)
    assert result.status == "fail", result


def test_accepts_owned_ci_worker_authority() -> None:
    result = verify(copy.deepcopy(VALID))
    assert result.status == "pass"
    assert len(result.evidence) == 6


def test_rejects_provider_authority() -> None:
    rejected(lambda p: p.update(provider="github-actions"))


def test_rejects_persistent_runner_identity() -> None:
    rejected(lambda p: p["runners"].update(ephemeral=False))


def test_rejects_host_execution() -> None:
    rejected(lambda p: p["runners"].update(host_execution=True))


def test_rejects_container_only_boundary() -> None:
    rejected(lambda p: p["runners"].update(isolation="container"))


def test_rejects_host_container_socket() -> None:
    rejected(lambda p: p["runners"].update(host_socket_mounted=True))


def test_rejects_unpinned_actions() -> None:
    rejected(lambda p: p["supply_chain"].update(actions_by_commit=False))


def test_rejects_release_keys_in_pr_jobs() -> None:
    rejected(lambda p: p["secrets"].update(release_key_available_to_pr_jobs=True))


def test_rejects_missing_second_operator_drill() -> None:
    rejected(lambda p: p["recovery"].update(second_operator="fail"))
