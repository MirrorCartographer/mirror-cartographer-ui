# Sovereign observability and independent operational evidence

## Scope

This layer owns collection, routing, retention, alert evaluation, synthetic evidence, export, backup, and clean-host restoration for metrics, logs, traces, and external-path results. Hosted dashboards and paging services may mirror or deliver evidence; they may not become the only witness, alert authority, or recovery path.

## Strongest surviving design

```text
workload-local OTLP endpoint
  -> local OpenTelemetry Collector
  -> project Prometheus / Loki TSDB / Tempo
  -> project Alertmanager cluster
  -> signed daily evidence manifests + independent backups
  -> optional hosted mirrors and notification commodities

independent probe networks
  -> DNS/TLS/HTTP/Reader behavioral probes
  -> raw signed result custody
  -> project alert evaluation
```

The operational record is not a Grafana dashboard. Canonical evidence consists of raw telemetry objects, rules, alert state, synthetic result records, configuration, and signed inventories that can be restored and queried without the original hosting or monitoring accounts.

## Why this design survived

### OpenTelemetry Collector as the collection boundary

The Collector provides a vendor-neutral OTLP ingress and explicit receiver/processor/exporter pipelines. Workloads send only to a local collector. The collector performs bounded buffering, retry, batching, and redaction. Direct application export to a commercial backend is prohibited because it embeds vendor authentication, schemas, endpoint availability, and billing into application behavior.

Collector components have different stability levels. Every enabled component must be pinned, inventoried, and tested before upgrades. The collector itself must expose internal metrics for queue occupancy, rejected spans, failed exports, retry counts, and process memory.

### Prometheus as metric and alert-rule authority

Two independently initialized Prometheus replicas scrape the same critical targets and evaluate the same signed rules. They do not rely on remote-write success for local alerting. Each sends firing alerts directly to every Alertmanager instance. Remote write is a secondary copy, not the only retention path.

Prometheus local TSDB is replaceable and finite. Long retention requires either independently backed TSDB blocks or a compatible long-term store. The project must retain raw rule files, recording rules, scrape configuration, and evidence manifests independently of any query UI.

### Three Alertmanager instances

Alertmanager clusters fail open during partitions: duplicates are preferable to missed critical notifications. Prometheus must address every Alertmanager directly rather than placing one load balancer in front. At least two notification routes must cross administrative failure domains. A continuously firing deadman alert proves the evaluation and delivery path is alive; delivery receipts or probe acknowledgements must be retained.

### Loki TSDB with object custody

Loki TSDB is selected for logs because it keeps a metadata index while storing compressed chunks in an object store. Filesystem mode is acceptable only for development or a disposable single-node cell; it does not provide credible production durability or clustered scaling. The canonical object store must be project-controlled or mirrored into project-controlled immutable objects with independently verified inventories.

### Tempo for bounded trace retention

Traces are diagnostic evidence, not the sole audit record. Tail sampling is preferred so error and high-latency traces survive while volume remains bounded. Sampling policy, dropped-trace counters, and collector pressure must be observable. Security and release audit events must never depend on probabilistically sampled traces.

### Independent synthetics

Internal telemetry cannot prove the public path. At least two external failure domains must run authoritative DNS, recursive DNS, TCP, TLS, HTTP, and Reader behavioral probes. Probe results are timestamped, signed or hash-chained, and stored by the project. A hosted synthetic provider may add geographic diversity but cannot be the sole record.

## Adversarial review before adoption

### Hosted observability suite as authority — rejected

A hosted suite can lose account access, change retention, throttle ingestion, alter queries, raise prices, or fail during the incident it should record. It may receive a mirror and deliver notifications, but the project must preserve primary evidence and rules.

### Grafana as canonical evidence — rejected

Grafana is a query and visualization layer. Dashboards contain interpretation and links, not all underlying observations. Dashboard backup alone cannot reconstruct alerts, logs, metric samples, trace objects, or delivery history.

### One all-in-one observability host — rejected

A single host is useful for development but creates a shared CPU, disk, power, patching, and corruption boundary. Critical metrics and alert evaluation require at least two independent cells; raw object custody and backups must survive complete loss of either.

### Remote write only — rejected

Remote write can lag, drop, queue, duplicate, or become unavailable. Local alert evaluation must continue, and loss counters must expose failures. A remote endpoint is a mirror, not the sole metric authority.

### Logs as audit trail — rejected

Ordinary application logs can be truncated, redacted, sampled, forged by a compromised host, or lost under backpressure. Security-sensitive actions require dedicated append-only audit events with authorization identity, sequence, and independent custody.

### Infinite retention — rejected

Unbounded telemetry causes disk exhaustion, object-count growth, index cost, backup expansion, and privacy exposure. Retention is explicit by signal class. High-value release, security, recovery, and incident evidence is promoted into compact signed evidence bundles rather than retaining all telemetry forever.

## Adversarial review after artifact production

The implementation must reject or expose:

- public OTLP ingestion;
- direct vendor exporters in the canonical pipeline;
- collectors without memory limiting, persistent queues, redaction, or loss counters;
- one Prometheus or one Alertmanager as the production design;
- a load balancer hiding Alertmanager members from Prometheus;
- one notification route;
- synthetic results stored only by the probe vendor;
- a hosted dashboard or alerting account as the only copy;
- missing deadman alerts;
- disk-full conditions without early alerts;
- silent queue overflow or dropped telemetry;
- secret-bearing headers, cookies, SQL statements, or user identifiers entering telemetry;
- object-store retention changes without signed review;
- restores that recreate dashboards but cannot answer evidence queries.

The committed verifier enforces 28 structural invariants and the mutation harness requires rejection of reduced redundancy, public ingestion, hosted alert authority, and missing loss evidence.

## Recovery contract

A clean-host observability recovery is accepted only when it can:

1. verify signed configuration and evidence manifests;
2. restore Prometheus rules and a bounded metric window;
3. restore Loki index/chunks and execute a known log query;
4. restore Tempo objects and retrieve a known trace;
5. start all Alertmanager members and recover routing/silence policy;
6. ingest a fixture OTLP metric, log, and trace;
7. fire a fixture alert and deliver it through two routes;
8. run public-path probes from two independent networks;
9. prove telemetry-loss and deadman alerts work;
10. record RPO, RTO, bytes, object counts, query latency, and manual actions.

## Build-versus-buy

### Adopted

- OpenTelemetry Collector for the protocol and processing boundary.
- Prometheus for local metrics and rule evaluation.
- Alertmanager for routing, grouping, inhibition, and fail-open HA.
- Loki TSDB over an S3-compatible object interface for logs.
- Tempo over the same replaceable object interface for traces.
- Grafana as a disposable UI generated from versioned dashboards.

### Replaceable commodities

- Hosted metrics/log/trace mirrors.
- Hosted paging, SMS, email, and voice delivery.
- Hosted external probes.
- Commodity S3-compatible storage providers.

Each commodity requires documented export, deletion, credential rotation, and cutover procedures.

### Rejected as sole authority

- Datadog, New Relic, Splunk, Grafana Cloud, cloud-native monitoring, or another SaaS suite.
- Provider-only logs and metrics.
- One Grafana database containing the only dashboard definitions.
- One paging provider.
- One external synthetic network.

### Deferred

- Thanos, Mimir, or VictoriaMetrics for long-term metrics. Adoption requires measured cardinality, query, retention, object-count, compaction, and restore benchmarks.
- Multi-region Loki/Tempo clusters. Initial cells should remain small and independently rebuildable.

## Ownership boundary achieved

The project owns:

- telemetry schemas and naming;
- collection configuration;
- redaction and sampling policy;
- alert and recording rules;
- canonical raw evidence locations;
- retention and deletion policy;
- synthetic probe definitions and raw results;
- dashboard source definitions;
- evidence manifests;
- backup and restore acceptance;
- backend replacement contracts.

The project does not thereby own:

- physical disks, CPUs, firmware, datacenters, electricity, or transit;
- global clock infrastructure;
- SMS, email, telephone, or mobile push networks;
- public DNS, Web PKI, or client devices;
- upstream maintenance of OpenTelemetry, Prometheus, Loki, Tempo, or Grafana.

The defensible claim is narrower: no monitoring vendor, cloud account, dashboard database, paging provider, or single telemetry backend is the sole witness, alert authority, or recovery route.

## Remaining risks

- Compromised workloads can emit false telemetry.
- Compromised hosts can suppress local evidence before collection.
- High-cardinality labels can exhaust memory and storage.
- Collector queues can consume disks during prolonged outages.
- Object-store bugs or credential compromise can delete logs and traces.
- Alertmanager fail-open behavior can generate duplicate pages.
- Clock skew can corrupt ordering and certificate validation.
- Sensitive data can escape through unanticipated attributes.
- Retention or compaction errors can delete evidence early.
- One operator can still weaken rules or silence alerts without threshold review.
- External probes remain dependent on networks the project cannot physically control.

## Cost and operational implications

The minimum credible footprint is two metric/evaluation cells, three Alertmanager members, two collector gateways, durable S3-compatible object storage, two independent external probe domains, two notification routes, backup storage, and clean-host recovery capacity.

Primary cost drivers are telemetry volume, metric cardinality, trace sampling rate, log retention, object operations, cross-site transfer, external probe geography, and operator time. A cardinality and ingestion budget must be enforced before production. Telemetry pipelines require patching, schema governance, privacy review, capacity planning, and recurring destructive restore drills.

## Next falsifiable build step

Provision two isolated observability cells and run a failure-and-recovery benchmark:

```text
pin and mirror all observability images by digest
-> validate collector, Prometheus, Loki, Tempo, and Alertmanager configs
-> emit fixture metric/log/trace traffic at measured rates
-> inject secret-bearing attributes and prove redaction
-> saturate collector memory and prove workload survival
-> cut every backend independently and measure queue/loss behavior
-> fill telemetry disk to thresholds and prove early alerting
-> kill one Prometheus and preserve alert evaluation
-> partition Alertmanager and observe fail-open duplicate delivery
-> disable notification route A and prove route B
-> stop hosted mirrors and preserve local evidence
-> run external probes from two networks
-> corrupt one Loki object and require restore verification failure
-> destroy one complete observability cell
-> restore on a clean host from independent custody
-> answer known metric, log, trace, alert, and synthetic queries
-> measure ingestion ceiling, cardinality limit, query latency, RPO, RTO, storage growth, bandwidth, cost, and manual steps
```

Until that succeeds, this layer is an implementation-ready control contract with executable static adversarial tests, not a proven production observability plane.
