#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const policy = path.join(here, "policy.json");
const base = JSON.parse(fs.readFileSync(path.join(here, "inventory.json"), "utf8"));
const verifier = path.join(here, "verify-observability-contract.mjs");

const mutations = [
  ["reject-hosted-authority", x => x.authority.hosted_authoritative = true],
  ["reject-dashboard-authority", x => x.authority.dashboard_authoritative = true],
  ["reject-fixed-backend", x => x.authority.replaceable = false],
  ["reject-unpinned-collector", x => x.collection.distribution_digest = "latest"],
  ["reject-no-buffer", x => x.collection.local_buffering = false],
  ["reject-no-backpressure", x => x.collection.backpressure = false],
  ["reject-no-drop-counters", x => x.collection.drop_counters = false],
  ["reject-open-receiver", x => x.collection.receiver_authentication = false],
  ["reject-public-admin", x => x.collection.admin_public = true],
  ["reject-unsigned-config", x => x.collection.config_digest = ""],
  ["reject-no-traces", x => x.signals.traces = false],
  ["reject-unknown-service", x => x.signals.unknown_service_rejected = false],
  ["reject-no-redaction", x => x.privacy.secret_redaction = false],
  ["reject-pii-default", x => x.privacy.pii_default_deny = false],
  ["reject-unbounded-cardinality", x => x.privacy.cardinality_budget = 0],
  ["reject-raw-payload", x => x.privacy.raw_payload_default = true],
  ["reject-one-prometheus", x => x.metrics.prometheus_replicas = x.metrics.prometheus_replicas.slice(0,1)],
  ["reject-same-prom-domain", x => x.metrics.prometheus_replicas.forEach(y=>y.domain="site-a")],
  ["reject-shared-scrape", x => x.metrics.prometheus_replicas[1].independent_scrape = false],
  ["reject-nfs-tsdb", x => x.metrics.tsdb_on_nfs = true],
  ["reject-one-remote-write", x => x.metrics.remote_write_targets = ["metrics-store-a"]],
  ["reject-no-backlog-alert", x => x.metrics.remote_write_backlog_alert = false],
  ["reject-untested-rules", x => x.metrics.rule_tests = false],
  ["reject-unversioned-log-store", x => x.logs.object_versioning = false],
  ["reject-short-delete-window", x => x.logs.deletion_cancel_window_hours = 1],
  ["reject-no-wal-corruption-alert", x => x.logs.wal_corruption_alert = false],
  ["reject-no-wal-disk-alert", x => x.logs.wal_disk_full_alert = false],
  ["reject-fulltext-authority", x => x.logs.full_text_index_authoritative = true],
  ["reject-no-portable-traces", x => x.traces.portable_otlp_export = false],
  ["reject-undefined-sampling-failure", x => x.traces.tail_sampling_failure_mode = "unknown"],
  ["reject-drop-errors", x => x.traces.error_and_high_latency_keep = false],
  ["reject-one-evaluator", x => x.alerting.evaluators = x.alerting.evaluators.slice(0,1)],
  ["reject-unaudited-silence", x => x.alerting.silence_audit = false],
  ["reject-permanent-silence", x => x.alerting.silence_expiry = false],
  ["reject-missing-data-ignored", x => x.alerting.missing_data_explicit = false],
  ["reject-no-deadman", x => x.alerting.deadman_switch = false],
  ["reject-one-channel", x => x.alerting.channels = ["local-pager"]],
  ["reject-no-blackbox", x => x.alerting.external_blackbox = false],
  ["reject-no-meta-monitoring", x => x.alerting.meta_monitoring = false],
  ["reject-backend-required", x => x.continuity.original_backend_required = true],
  ["reject-grafana-required", x => x.continuity.grafana_required = true],
  ["reject-dns-required", x => x.continuity.public_dns_required_for_internal_diagnosis = true],
  ["reject-no-raw-export", x => x.continuity.portable_raw_export = false],
  ["reject-stale-restore", x => x.continuity.last_clean_host_restore_age_days = 31],
  ["reject-one-operator", x => x.continuity.trained_operators = 1],
  ["reject-unsigned-evidence", x => x.evidence.signed = false],
  ["reject-no-loss-measurement", x => x.evidence.ingest_loss_measurement = false],
  ["reject-no-alert-test", x => x.evidence.alert_delivery_test = false]
];

function run(inv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "observability-contract-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, JSON.stringify(inv, null, 2));
  const result = spawnSync(process.execPath, [verifier, policy, file], {encoding: "utf8"});
  fs.rmSync(dir, {recursive: true, force: true});
  return result;
}

let result = run(base);
if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  process.exit(1);
}
console.log("PASS baseline");

for (const [name, mutate] of mutations) {
  const inv = structuredClone(base);
  mutate(inv);
  result = run(inv);
  if (result.status === 0) {
    console.error(`FAIL ${name}: verifier accepted degraded inventory`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}
console.log("PASS adversarial observability controls");
