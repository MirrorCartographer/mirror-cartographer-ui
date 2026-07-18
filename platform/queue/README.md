# Sovereign Queue and Event Transport Plane

## Surviving architecture

The project owns a canonical event catalog, message envelope, subject policy, schema compatibility rules, consumer contracts, retention policy, replay procedure, and evidence. NATS JetStream is the initial durable transport adapter; RabbitMQ quorum queues and Kafka-compatible logs are comparison and migration targets.

Three JetStream nodes span three failure domains. Critical streams use file storage on independent local SSDs, three replicas, publish acknowledgements, `DiscardNew`, bounded storage, explicit pull consumers, and project-controlled snapshots and portable event exports.

## Delivery semantics

Broker-level exactly-once features do not prove exactly-once application effects. JetStream publication deduplication is bounded by a configured rolling window and consumer double acknowledgements prove receipt of the acknowledgement. A database commit can still succeed while the process dies before acknowledging, so handlers require stable event IDs and an idempotency ledger or a transactionally coupled inbox/outbox.

The application contract is:

1. Producer commits state and an outbox record in one database transaction.
2. Relay publishes with stable event ID and waits for broker acknowledgement.
3. Consumer writes its event ID to an idempotency/inbox table in the same transaction as its side effect.
4. Consumer acknowledges only after that transaction commits.
5. Redelivery becomes a verified no-op.

## Ordering

No global ordering claim is admitted. Ordering is defined per project-selected key, with a producer sequence and consumer gap detection. Wall-clock time is evidence, not sequence authority.

## Capacity and poison messages

Critical streams reject new publishes visibly when their configured capacity is exhausted rather than deleting unconsumed old messages. Pull consumers have bounded batches, bytes, pending acknowledgements, retry delays, and delivery attempts. Exhausted messages move through an at-least-once dead-letter path and remain tied to their original event identity and failure evidence.

## Ownership boundary

### Project-owned

Event envelope and catalog, schemas, subject namespace, ordering keys, idempotency semantics, retention, dead-letter rules, replay authority, portable export, evidence, and recovery acceptance.

### Replaceable

NATS JetStream, RabbitMQ quorum queues, Kafka-compatible brokers, object stores, SSDs, VMs, physical servers, and hosted queue services.

### Not physically owned

CPU and disk fabrication, firmware, facilities, power, network transit, DNS, BGP, public CAs, and upstream broker supply chains.

## Rejected directions

- Core NATS for durable business events.
- One hosted queue account as canonical event custody.
- Broker deduplication described as universal exactly-once execution.
- Global ordering claims across independent subjects or partitions.
- Acknowledgement before side-effect commit.
- Infinite retries or silent poison-message deletion.
- `DiscardOld` for critical unconsumed work.
- Shared network storage beneath JetStream.
- Broker-native snapshots as the only portable recovery format.

## Unproven production evidence

The inventory is a design fixture. Production admission still requires live quorum persistence, duplicate publication during lost acknowledgements, consumer crash after side-effect commit, poison-message dead lettering, capacity exhaustion, one-site loss, disk-full behavior, stream snapshot restoration, portable replay into another broker, and application-level idempotency evidence.

## Commands

```sh
node platform/queue/verify-queue-contract.mjs platform/queue/policy.json platform/queue/inventory.json
node platform/queue/test.mjs
```

## Next destructive laboratory

Start three pinned JetStream nodes on independent local SSDs; publish through a transactional outbox; terminate publishers before and after confirmation; kill consumers before and after database commit; partition the stream leader from one and then two replicas; fill the stream to its byte limit; inject poison messages; snapshot and export the event range; restore onto clean hosts; replay the canonical envelopes through RabbitMQ quorum queues; and compare every accepted application effect against stable event IDs and per-key sequence numbers.
