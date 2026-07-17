# Sovereign Queue and Event Delivery Contract

This directory defines the project-owned admission contract for durable asynchronous work, event publication, retries, replay, and broker recovery.

## Surviving architecture

The initial mechanism is a three-node NATS JetStream cluster across three independently failing sites. Applications commit business state and an outbox row in one PostgreSQL transaction. A relay publishes each outbox event with a stable message identifier and waits for broker acknowledgement. Consumers use durable pull subscriptions, bounded batches, explicit acknowledgements, and a PostgreSQL inbox/idempotency record committed in the same transaction as their side effects.

The reliable claim is **at-least-once delivery with idempotent effects**. The project does not claim universal end-to-end exactly-once execution. Network ambiguity, lost acknowledgements, process termination, replay, and external side effects can all produce duplicate delivery attempts.

## Authority boundary

The project owns topology source, subject and schema definitions, retention and saturation rules, retry policy, dead-letter custody, replay authorization, evidence, exports, and recovery procedures. NATS, RabbitMQ, Kafka, hosted brokers, VMs, disks, and networks are replaceable mechanisms.

The project does not physically own CPU fabrication, disk firmware, datacenter power, ISP transit, BGP, DNS registries, or public network paths merely by operating the queue software.

## Operational decisions

- Reject new publications when a critical stream reaches its admitted capacity. Never silently discard the oldest unprocessed critical message.
- Require publisher acknowledgements and explicit consumer acknowledgements.
- Acknowledge only after durable side effects and idempotency state commit.
- Bound retries, add jitter, retain poison messages, and audit replay.
- Keep broker-neutral envelopes and exportable topology so a second implementation can be reconstructed.
- Maintain three backup copies across at least two failure domains, including an offline copy.
- Prohibit credentials and secret values in message payloads.
- Require schema versioning and an explicit compatibility window.

## Rejected directions

- Core NATS for durable business events: it is at-most-once and loses messages when subscribers are absent.
- Redis lists or Pub/Sub as the canonical durable queue: insufficient recovery and delivery evidence for critical work.
- One hosted broker account: provider suspension, billing, API, region, credential, or export failure becomes loss of authority.
- Distributed two-phase commit between application database and broker: increases coupling and does not remove operational failure modes.
- Infinite retry: poison messages consume capacity and hide permanent incompatibility.
- Automatic acknowledgement before side effects: worker death can lose accepted work.
- “Exactly once” as a blanket system claim: broker deduplication windows cannot prove that arbitrary external side effects happened once.

## Production evidence still required

The checked-in inventory is a design fixture. Production admission must derive evidence from live cluster membership, replica placement, server configuration, storage flush settings, publish acknowledgements, consumer redelivery, queue limits, network partitions, exported message envelopes, backup hashes, clean-host restore, schema compatibility tests, and signed replay records.

## Commands

```sh
node platform/queue/verify-queue-contract.mjs platform/queue/policy.json platform/queue/inventory.json
node platform/queue/test.mjs
```

## Next destructive laboratory

Start three pinned broker nodes, publish through a transactional outbox, terminate publishers before and after confirmation, kill consumers before and after database commit, partition the leader from one and then two replicas, saturate the stream, inject poison messages, restore from an offline export onto clean hosts, and compare all accepted business effects against unique event identifiers.
