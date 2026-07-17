import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync(new URL('./policy.json', import.meta.url)));
const inventory = JSON.parse(fs.readFileSync(new URL('./inventory.json', import.meta.url)));
const checks = [];
const requireCheck = (name, condition) => {
  checks.push(name);
  if (!condition) throw new Error(`REJECT ${name}`);
};

requireCheck('project-capacity-authority', policy.authority.project_controls_capacity_policy && !policy.authority.provider_autoscaling_authoritative);
requireCheck('exportable-desired-state', policy.authority.desired_state_exportable && inventory.controller.desired_state_exportable);
requireCheck('audited-manual-override', policy.authority.manual_override_audited);
requireCheck('two-operator-destructive-scale', policy.authority.destructive_scale_actions_require_operators >= 2);
requireCheck('workload-classification', policy.workload.classification_required && inventory.workloads.every(w => w.class));
requireCheck('stateful-native-plan', policy.workload.stateful_scaling_requires_service_native_plan);
requireCheck('minimum-ready-replicas', policy.workload.minimum_ready_replicas >= 2 && inventory.workloads.every(w => w.min_ready >= 2));
requireCheck('explicit-max-replicas', policy.workload.maximum_replicas_explicit && inventory.workloads.every(w => Number.isInteger(w.max_replicas) && w.max_replicas >= w.min_ready));
requireCheck('failure-domain-separation', policy.workload.failure_domains_minimum >= 2 && inventory.workloads.every(w => new Set(w.failure_domains).size >= 2));
requireCheck('readiness-and-warmup', policy.workload.readiness_gates_required && policy.workload.startup_warmup_excluded_from_metrics);
requireCheck('graceful-drain', policy.workload.graceful_drain_required && policy.workload.termination_budget_seconds >= 30);
requireCheck('independent-signals', policy.signals.multiple_independent_metrics && inventory.workloads.every(w => w.signals.length >= 2));
requireCheck('saturation-signal', policy.signals.saturation_metric_required && inventory.workloads.every(w => w.signals.some(s => s.includes('saturation'))));
requireCheck('async-backlog-signal', policy.signals.queue_age_or_backlog_required_for_async && inventory.workloads.filter(w => w.class.includes('async')).every(w => w.signals.includes('oldest_message_age') || w.signals.includes('backlog')));
requireCheck('sync-demand-signal', policy.signals.request_rate_or_concurrency_required_for_sync && inventory.workloads.filter(w => w.class.includes('sync')).every(w => w.signals.some(s => s.includes('request') || s.includes('concurrency'))));
requireCheck('fresh-metrics', policy.signals.metrics_freshness_limit_seconds <= 60);
requireCheck('missing-metrics-safe', policy.signals.missing_metrics_fail_closed_for_scale_down && !policy.signals.provider_metric_sole_signal);
requireCheck('bounded-scale-up-delay', policy.control_loop.scale_up_max_delay_seconds <= 30);
requireCheck('stabilized-scale-down', policy.control_loop.scale_down_stabilization_seconds >= 300 && policy.control_loop.scale_down_max_percent_per_minute <= 10);
requireCheck('critical-no-scale-zero', !policy.control_loop.scale_to_zero_for_critical_services && inventory.workloads.every(w => !w.scale_to_zero));
requireCheck('anti-flap-control', policy.control_loop.anti_flap_hysteresis && policy.control_loop.bounded_rate_of_change);
requireCheck('capacity-headroom', policy.capacity.headroom_percent >= 30 && policy.capacity.reserved_failure_capacity);
requireCheck('overload-controls', policy.capacity.admission_control_required && policy.capacity.load_shedding_required && policy.capacity.backpressure_required && inventory.overload.admission_control && inventory.overload.load_shedding && inventory.overload.backpressure);
requireCheck('bounded-queues', policy.capacity.bounded_queues_required && inventory.overload.bounded_queues);
requireCheck('priority-classes', policy.capacity.priority_classes_required && inventory.overload.priority_classes.length >= 3);
requireCheck('early-capacity-alert', policy.capacity.capacity_exhaustion_alert_percent <= 70);
requireCheck('downstream-budgets', policy.dependency_limits.database_connection_budget_required && policy.dependency_limits.queue_consumer_budget_required && policy.dependency_limits.external_api_budget_required && inventory.workloads.every(w => Object.keys(w.downstream_budgets).length >= 1));
requireCheck('per-replica-resources', policy.dependency_limits.per_replica_resource_requests_and_limits);
requireCheck('downstream-throttle', policy.dependency_limits.downstream_capacity_must_scale_or_throttle);
requireCheck('adversarial-capacity-evidence', policy.verification.load_test_required && policy.verification.failure_domain_loss_test_required && policy.verification.metric_loss_test_required && policy.verification.thundering_herd_test_required && policy.verification.cold_start_benchmark_required && inventory.evidence.load_test && inventory.evidence.failure_domain_loss && inventory.evidence.metric_loss && inventory.evidence.thundering_herd && inventory.evidence.cold_start_benchmark);
requireCheck('signed-fresh-evidence', policy.verification.signed_capacity_evidence && inventory.evidence.signed && inventory.evidence.age_days <= policy.verification.evidence_max_age_days);
requireCheck('provider-and-dns-independent-control', policy.verification.provider_outage_scale_path && policy.verification.public_dns_not_required_for_manual_scale && inventory.evidence.provider_outage_scale_path && inventory.evidence.dns_independent_manual_scale);

console.log(`ACCEPT ${checks.length} scaling invariants`);
