# Sovereign observability authority

## Scope

This plane defines project authority over metrics, logs, traces, alerting, telemetry retention, and evidence. External monitoring services may receive mirrored telemetry, but they are not canonical policy, sole custody, or the only outage-detection path.

## Strongest surviving design

1. Host-local OpenTelemetry agents buffer telemetry to disk.
2. At least two gateway collectors in separate failure domains apply source-controlled processing and export policy.
3. Two independent Prometheus-compatible scrapers retain local WALs and write to two project-controlled metric stores.
4. Structured logs retain event and observed timestamps, trace context, and redaction state; Loki-compatible object data is held in three copies including one immutable copy.
5. Trace sampling policy is source-controlled. Tail sampling is admitted only with trace-affinity routing.
6. Two alert evaluators send every alert directly to all three Alertmanagers. Duplicate notifications during partitions are accepted rather than suppressing an outage.
7. An independent deadman and meta-monitor path lives outside the main observability failure domain.
8. Configurations, rules, retention manifests, raw exports, and clean-host restoration evidence remain project-controlled and portable.

## False sovereignty rejected

- Provider dashboards as the only telemetry record.
- One collector gateway.
- Memory-only buffering.
- Metrics without WAL or raw export.
- A single alert evaluator or notification path.
- Sending alerts through one load balancer to Alertmanager.
- Logs stored only on one filesystem or one object-storage account.
- Tail sampling without ensuring all spans for a trace reach one sampling decision point.
- High-cardinality values promoted into indexed log labels.
- Observability services holding release-signing keys.
- Monitoring a monitoring stack only from inside that same stack.

## Ownership boundary

Project-owned: telemetry schema, labels, sampling, redaction, SLOs, alert rules, silence policy, retention manifests, storage indexes, evidence, restoration procedures, and admission logic.

Replaceable: OpenTelemetry Collector, Prometheus-compatible engines, Loki-compatible log stores, Tempo/Jaeger-compatible trace stores, Alertmanager, Grafana, object storage, VMs, and notification relays.

Not physically owned: CPU and disk fabrication, datacenter power, ISP and transit networks, DNS registries, public CAs, telephone/email carrier delivery, and external time standards.

## Production evidence still required

The checked-in inventory is a design fixture. Production admission must derive evidence from collector queue/drop counters, WAL health, scrape target state, label cardinality, object hashes, retention execution, alert receipts, external deadman receipts, provider-outage tests, and cross-implementation restore results. Evidence must be signed by two operators.

## Next destructive laboratory

Deploy two agents, two gateways, two scrapers, three Alertmanagers, metric/log/trace stores, and an independent deadman. Saturate collector queues, fill a WAL disk, corrupt a log WAL, remove one site, disconnect the hosted mirror, break public DNS, and destroy the principal observability stores. Rebuild from offline configuration and object custody; verify that outage detection, alert delivery, raw telemetry reconciliation, and historical queries survive.
