#!/usr/bin/env node
import fs from "node:fs";

const [policyPath, inventoryPath] = process.argv.slice(2);
if (!policyPath || !inventoryPath) {
  console.error("usage: verify-observability-contract.mjs POLICY INVENTORY");
  process.exit(2);
}
const p = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const i = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const digest = value => /^sha256:[0-9a-f]{64}$/.test(value ?? "");

check(i.authority.project_owned && i.authority.alert_policy_owned, "project must own telemetry schema and alert policy");
check(!i.authority.hosted_authoritative && !i.authority.dashboard_authoritative, "hosted backend/dashboard cannot be authoritative");
check(i.authority.replaceable && i.authority.evidence_exportable, "telemetry backends and evidence must be portable");

check(i.collection.otel_collector, "OpenTelemetry Collector required");
check(digest(i.collection.distribution_digest), "collector distribution must be digest pinned");
check(i.collection.agent_gateway_layers, "agent and gateway collection layers required");
check(i.collection.local_buffering && i.collection.backpressure && i.collection.drop_counters, "buffering, backpressure, and drop counters required");
check(i.collection.receiver_authentication && !i.collection.admin_public, "collector endpoints require authentication and private administration");
check(i.collection.config_source_controlled && digest(i.collection.config_digest), "source-controlled collector config digest required");

for (const key of ["metrics","logs","traces","events"]) check(i.signals[key], `missing signal: ${key}`);
check(i.signals.stable_resource_identity, "stable resource identity required");
check(typeof i.signals.schema_version === "string" && i.signals.schema_version.length > 0, "telemetry schema version required");
check(i.signals.trace_log_correlation && i.signals.clock_uncertainty_recorded, "correlation and clock uncertainty required");
check(i.signals.unknown_service_rejected, "unknown services must be rejected or quarantined");

check(i.privacy.attribute_allowlist && i.privacy.secret_redaction && i.privacy.pii_default_deny, "privacy allowlist/redaction required");
check(Number.isInteger(i.privacy.cardinality_budget) && i.privacy.cardinality_budget > 0, "cardinality budget required");
check(!i.privacy.raw_payload_default, "raw payload capture forbidden by default");
check(i.privacy.tenant_isolation && i.privacy.deletion_authority_separate, "tenant isolation and deletion separation required");

check(i.metrics.prometheus_replicas.length >= p.metrics.minimum_prometheus_replicas, "insufficient Prometheus replicas");
check(new Set(i.metrics.prometheus_replicas.map(x=>x.domain)).size >= 2, "Prometheus replicas require independent domains");
check(i.metrics.prometheus_replicas.every(x=>x.independent_scrape), "Prometheus replicas must scrape independently");
check(i.metrics.local_tsdb && !i.metrics.tsdb_on_nfs, "local non-NFS TSDB required");
check(i.metrics.remote_write_targets.length >= 2, "dual remote-write targets required");
check(i.metrics.remote_write_backlog_alert, "remote-write backlog alert required");
check(i.metrics.recording_rules_source_controlled && i.metrics.rule_tests && i.metrics.cardinality_limits, "rule and cardinality controls required");

check(i.logs.loki_tsdb, "Loki TSDB required");
check(i.logs.object_storage_project_custody && i.logs.object_versioning, "project-custodied versioned log object storage required");
check(i.logs.retention_source_controlled, "log retention must be source controlled");
check(i.logs.deletion_cancel_window_hours >= p.logs.deletion_cancel_window_hours, "log deletion cancellation window too short");
check(i.logs.wal_corruption_alert && i.logs.wal_disk_full_alert, "Loki WAL failure alerts required");
check(i.logs.label_cardinality_limits && !i.logs.full_text_index_authoritative, "log label limits and non-authoritative full text index required");

check(i.traces.portable_otlp_export && i.traces.sampling_policy_source_controlled, "portable trace export and source-controlled sampling required");
check(["fail-open-with-measured-loss","fail-closed"].includes(i.traces.tail_sampling_failure_mode), "tail-sampling failure mode required");
check(i.traces.error_and_high_latency_keep && i.traces.sampling_rate_recorded, "trace retention priorities and sampling evidence required");
check(i.traces.storage_project_custody, "trace storage requires project custody");

check(i.alerting.evaluators.length >= p.alerting.minimum_independent_evaluators, "insufficient alert evaluators");
check(new Set(i.alerting.evaluators.map(x=>x.domain)).size >= 2, "alert evaluators require independent domains");
check(i.alerting.rules_source_controlled && i.alerting.silence_audit && i.alerting.silence_expiry, "alert and silence governance required");
check(i.alerting.missing_data_explicit && i.alerting.deadman_switch, "missing data and deadman detection required");
check(i.alerting.channels.length >= 2, "multiple alert delivery channels required");
check(i.alerting.external_blackbox && i.alerting.meta_monitoring, "external and meta-monitoring required");

check(!i.continuity.original_backend_required && !i.continuity.grafana_required, "recovery must not require original backend or Grafana");
check(!i.continuity.public_dns_required_for_internal_diagnosis, "internal diagnosis must not require public DNS");
check(i.continuity.portable_raw_export, "portable raw telemetry export required");
check(i.continuity.last_clean_host_restore_age_days <= p.continuity.clean_host_restore_max_age_days, "clean-host observability restore is stale");
check(i.continuity.trained_operators >= p.continuity.minimum_trained_operators, "insufficient trained observability operators");
check(i.continuity.offline_runbook, "offline incident runbook required");

check(i.evidence.machine_generated && i.evidence.signed, "signed machine-generated evidence required");
for (const key of ["config_digests","ingest_loss_measurement","query_reconciliation","alert_delivery_test","restore_result"]) check(i.evidence[key], `missing evidence: ${key}`);
check(i.evidence.operator_signatures >= 2, "two evidence signatures required");
check(i.evidence.retention_days >= p.evidence.retention_days, "evidence retention insufficient");

if (failures.length) {
  console.error(`REJECT ${failures.length} observability invariant(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("ACCEPT 66 observability invariants");
