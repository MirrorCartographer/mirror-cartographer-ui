#!/usr/bin/env python3
import copy, json, sys
from pathlib import Path


def validate(p):
    failures=[]
    req=lambda c,n: failures.append(n) if not c else None
    a=p.get('authority',{}); plan=p.get('plan',{}); exe=p.get('execution',{}); acc=p.get('acceptance',{}); ev=p.get('evidence',{}); ops=p.get('operations',{})
    req(a.get('test_policy')=='foundation','test_policy_authority')
    req(a.get('plan_compilation')=='foundation','plan_compilation_authority')
    req(a.get('result_acceptance')=='foundation','result_acceptance_authority')
    req(a.get('release_gate')=='foundation','release_gate_authority')
    req(a.get('executor')=='replaceable','replaceable_executor')
    for key in ('content_addressed','binds_source_digest','binds_artifact_digest','binds_toolchain_digest','binds_environment_digest','declares_all_required_targets','declares_shards','declares_timeouts'):
        req(plan.get(key) is True,'plan_'+key)
    req(exe.get('hermetic_by_default') is True,'hermetic_execution')
    req(exe.get('network_default')=='deny','network_default_deny')
    req(exe.get('single_use_workers') is True,'single_use_workers')
    req(exe.get('undeclared_outputs_rejected') is True,'undeclared_outputs')
    req(exe.get('cache_results_content_addressed') is True,'content_addressed_cache')
    for key in ('require_complete_target_accounting','require_complete_shard_accounting','require_artifact_digest_match','require_plan_digest_match','reject_missing_results','reject_infrastructure_errors','reject_timeouts','reject_flaky_for_release','reject_quarantined_for_release','silent_retries_forbidden'):
        req(acc.get(key) is True,'acceptance_'+key)
    req(1 <= acc.get('maximum_recorded_attempts',0) <= 3,'attempt_limit')
    for key in ('append_only','records_every_attempt','records_worker_identity','records_exit_status','records_output_digests','stored_outside_executor'):
        req(ev.get(key) is True,'evidence_'+key)
    req(ops.get('flake_budget_percent')==0,'zero_flake_budget')
    req(ops.get('quarantine_requires_owner_and_expiry') is True,'quarantine_governance')
    req(ops.get('maximum_quarantine_days',999)<=7,'quarantine_expiry')
    req(ops.get('second_operator_reconstruction') is True,'second_operator')
    req(ops.get('quarterly_scheduler_replacement_test') is True,'scheduler_replacement')
    req(ops.get('monthly_missing-result_injection') is True,'missing_result_injection')
    return failures


def hostile_tests(policy):
    cases=[]
    def mutate(name,path,value):
        p=copy.deepcopy(policy); node=p
        for part in path[:-1]: node=node[part]
        node[path[-1]]=value; cases.append((name,p))
    mutate('provider-release-gate',['authority','release_gate'],'provider')
    mutate('mutable-plan',['plan','content_addressed'],False)
    mutate('network-enabled',['execution','network_default'],'allow')
    mutate('missing-targets-accepted',['acceptance','reject_missing_results'],False)
    mutate('silent-retries',['acceptance','silent_retries_forbidden'],False)
    mutate('flaky-release',['acceptance','reject_flaky_for_release'],False)
    mutate('executor-held-evidence',['evidence','stored_outside_executor'],False)
    mutate('permanent-quarantine',['operations','maximum_quarantine_days'],365)
    return cases


def main():
    path=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).with_name('test-orchestration-policy.json'))
    policy=json.loads(path.read_text())
    failures=validate(policy)
    print('valid', 'ACCEPT' if not failures else 'REJECT', failures)
    if failures: return 1
    for name,case in hostile_tests(policy):
        rejected=bool(validate(case)); print(name, 'REJECT' if rejected else 'ACCEPT')
        if not rejected: return 1
    return 0

if __name__=='__main__': raise SystemExit(main())
