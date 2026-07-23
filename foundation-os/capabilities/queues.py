from __future__ import annotations

from adapter import CapabilityResult, finish, require

CAPABILITY = "queues"


def verify(plan: dict) -> CapabilityResult:
    failures: list[str] = []
    evidence: list[str] = []

    require(plan.get("authority") == "foundation", "authority", failures)
    require(plan.get("provider") is None, "provider-binding", failures)

    broker = plan.get("broker", {})
    require(broker.get("implementation") == "rabbitmq", "broker", failures)
    require(broker.get("version") == "4.3.2", "version", failures)
    require(broker.get("nodes", 0) >= 3, "quorum", failures)
    require(broker.get("failure_domains", 0) >= 3, "failure-domains", failures)
    require(broker.get("lan_cluster_only") is True, "wan-cluster", failures)

    delivery = plan.get("delivery", {})
    require(delivery.get("queue_type") == "quorum", "queue-type", failures)
    require(delivery.get("publisher_confirms") is True, "publisher-confirms", failures)
    require(delivery.get("manual_ack") is True, "consumer-acks", failures)
    require(delivery.get("idempotency_keys") is True, "idempotency", failures)
    require(0 < delivery.get("delivery_limit", 0) <= 20, "delivery-limit", failures)
    require(delivery.get("dead_letter_strategy") == "at-least-once", "dead-letter", failures)
    require(delivery.get("overflow") == "reject-publish", "overflow", failures)

    custody = plan.get("custody", {})
    require(custody.get("broker_is_canonical") is False, "broker-authority", failures)
    require(custody.get("canonical_journal") in {"postgres-outbox", "object-cas"}, "journal", failures)
    require(custody.get("definitions_export") is True, "definitions-export", failures)
    require(custody.get("replay_test") == "pass", "replay", failures)
    require(custody.get("clean_rebuild") == "pass", "clean-rebuild", failures)
    require(custody.get("offline_export") is True, "offline-export", failures)

    recovery = plan.get("recovery", {})
    for drill in ("node_loss", "minority_partition", "poison_message", "disk_pressure", "cluster_loss"):
        require(recovery.get(drill) == "pass", drill, failures)
    require(recovery.get("second_operator") is True, "single-operator", failures)

    if not failures:
        evidence.extend([
            "three-node RabbitMQ quorum",
            "publisher confirms and consumer acknowledgements",
            "idempotent delivery with bounded poison handling",
            "canonical journal outside the broker",
            "clean-cluster replay recovery",
        ])
    return finish(CAPABILITY, evidence, failures)
