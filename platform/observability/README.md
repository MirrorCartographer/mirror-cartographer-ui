# Sovereign Observability Plane

## Authority

The project owns telemetry schemas, collection policy, retention, alert semantics, silences, evidence, and recovery. OpenTelemetry, Prometheus, Loki, Tempo, Grafana, and hosted backends are replaceable mechanisms.

Dashboards are views, not canonical evidence. A green dashboard cannot overrule missing telemetry, failed collectors, stale rules, or lost alert delivery.

## Initial architecture

Applications and hosts emit OTLP or approved native formats to host-local OpenTelemetry Collectors. Collectors apply resource identity, schema validation, redaction, cardinality controls, buffering, and explicit drop accounting before forwarding to two gateway collectors.

Metrics are independently scraped by two Prometheus servers in separate failure domains. Each keeps local TSDB data and remote-writes to two project-custodied long-term targets. Logs use Loki TSDB with versioned object storage. Traces remain exportable as OTLP and use source-controlled sampling.

## Failure semantics

Telemetry loss must be measurable. Collector queue saturation, exporter failure, remote-write backlog, WAL corruption, disk-full behavior, rejected records, and sampling decisions are first-class signals.

The observability plane monitors itself and is also checked from outside its failure domain. Missing telemetry is modeled explicitly rather than interpreted as healthy.

## Alert authority

Alert rules, recording rules, inhibition, and routing are source controlled and tested. Two independent evaluators execute critical alerts. Silences require identity, reason, scope, and expiry. A deadman alert proves the evaluation and delivery path remains active.

## Privacy

Telemetry is treated as potentially sensitive production data. Attribute allowlists, secret redaction, PII default-deny, raw payload prohibition, tenant isolation, and deletion separation are mandatory.

## Continuity

Recovery must work without Grafana or the original telemetry backend. Raw portable exports, configuration digests, rules, dashboards, object manifests, and alert-routing state are retained in project custody.

## Ownership boundary

### Project-owned
Telemetry schema, resource identity, redaction, cardinality budgets, collector configuration, rules, alert semantics, retention, evidence, and recovery acceptance.

### Replaceable
OpenTelemetry Collector, Prometheus, Loki, Tempo, Grafana, Mimir, Thanos, VictoriaMetrics, object stores, hosted observability services, VMs, and physical hosts.

### Not physically owned
CPU and disk fabrication, firmware, facilities, power, public networks, DNS roots, public CAs, third-party notification networks, and upstream software supply chains.

## Production evidence still required

Live collector saturation, exporter outage, remote-write backlog, WAL corruption, disk-full behavior, cardinality overflow, privacy redaction, multi-evaluator alert delivery, deadman failure, hosted-backend loss, query reconciliation, raw export, and clean-host cross-backend restoration.
