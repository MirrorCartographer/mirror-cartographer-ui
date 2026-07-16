import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPromotion, requiredCheckProfileDigest } from './validate-promotion-evidence.v1.mjs';

const sha = 'a'.repeat(40);
const nowMs = Date.parse('2026-07-16T09:00:00.000Z');
const requiredChecks = ['build','smoke','mobile','accessibility','interaction','audio','deployment_identity','rollback','adversarial_review'];
const checklist = {
  source_branch: 'preview', target_branch: 'main',
  expected_deployment_identity: {
    github_repo_id: 1003910384,
    github_repository: 'MirrorCartographer/mirror-cartographer-ui',
    vercel_project_name: 'mirror-cartographer-ui',
    vercel_project_id: null
  },
  required_checks: requiredChecks,
  required_check_profile: {
    id: 'preview-promotion-core',
    version: 1,
    sha256: requiredCheckProfileDigest(requiredChecks)
  },
  promotion_requires: {
    preview_deployment_state: 'ready',
    max_deployment_evidence_age_ms: 900000,
    max_required_check_age_ms: 900000
  }
};
function immutableDeploymentEvidence() {
  return {
    expected_commit_sha: sha,
    observed_at: new Date(nowMs - 1000).toISOString(),
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_Valid123', url: 'mirror-preview-abc.vercel.app', projectId: 'prj_123', name: 'mirror-cartographer-ui',
      readyState: 'READY', status: 'READY', target: null, createdAt: nowMs - 3000, ready: nowMs - 2000,
      gitSource: { type: 'github', sha, ref: 'preview', repoId: 1003910384 }
    }
  };
}
function evidence() {
  return {
    source_branch:'preview', target_branch:'main', preview_commit:sha,
    preview_url:'https://mirror-preview-abc.vercel.app', preview_deployment_state:'ready',
    deployment_commit:sha, evidence_commit:sha, unresolved_critical_risks:0,
    rollback_route_recorded:true, rollback_route:'revert '+sha,
    deployment_identity_evidence: immutableDeploymentEvidence(),
    checks:Object.fromEntries(checklist.required_checks.map((name)=>[name,{status:'pass',commit:sha,observed_at:new Date(nowMs - 1000).toISOString()}]))
  };
}
const assess = (c, e) => assessPromotion(c, e, { nowMs });

function withChecks(names, profile = {}) {
  return {
    ...checklist,
    required_checks: names,
    required_check_profile: {
      id: 'preview-promotion-core',
      version: 1,
      sha256: requiredCheckProfileDigest(names),
      ...profile
    }
  };
}

test('accepts complete commit-bound ready evidence with fresh deployment and check observations', () => {
  const result = assess(checklist,evidence());
  assert.equal(result.promotable,true);
  assert.equal(result.schema_version,7);
  assert.equal(result.required_check_profile_id,'preview-promotion-core');
  assert.equal(result.required_check_profile_calculated_sha256,checklist.required_check_profile.sha256);
  assert.equal(result.immutable_deployment_identity_verified,true);
  assert.equal(result.immutable_deployment_git_ref,'preview');
  assert.equal(result.immutable_deployment_github_repo_id,1003910384);
  assert.equal(result.immutable_deployment_project_name,'mirror-cartographer-ui');
  assert.equal(result.deployment_evidence_age_ms,1000);
  assert.equal(result.passed_required_check_count,checklist.required_checks.length);
});
test('rejects canceled state', () => { const e=evidence(); e.preview_deployment_state='canceled'; assert.equal(assess(checklist,e).promotable,false); });
test('rejects check commit mismatch', () => { const e=evidence(); e.checks.smoke.commit='b'.repeat(40); assert.ok(assess(checklist,e).failures.includes('required_check_commit_mismatch:smoke')); });
test('rejects missing rollback route', () => { const e=evidence(); e.rollback_route=''; assert.ok(assess(checklist,e).failures.includes('rollback_route_missing')); });
test('rejects unresolved critical risk', () => { const e=evidence(); e.unresolved_critical_risks=1; assert.ok(assess(checklist,e).failures.includes('critical_risks_remaining')); });
test('rejects a pass label without immutable deployment evidence', () => {
  const e=evidence(); delete e.deployment_identity_evidence;
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_identity_unverified'));
});
test('rejects immutable deployment proof for another commit', () => {
  const e=evidence(); e.deployment_identity_evidence.expected_commit_sha='b'.repeat(40); e.deployment_identity_evidence.deployment.gitSource.sha='b'.repeat(40);
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_expected_commit_mismatch'));
});
test('rejects an alias or unrelated HTTPS URL despite valid deployment identity', () => {
  const e=evidence(); e.preview_url='https://mirror.example.com';
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('preview_url_not_immutable_deployment_hostname'));
});
test('rejects stale deployment state', () => { const e=evidence(); e.preview_deployment_state='stale'; assert.equal(assess(checklist,e).promotable,false); });
test('rejects a READY deployment for the same commit from main', () => {
  const e=evidence(); e.deployment_identity_evidence.deployment.gitSource.ref='main';
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_source_branch_mismatch'));
});
test('rejects a production-target deployment as preview evidence', () => {
  const e=evidence(); e.deployment_identity_evidence.deployment.target='production';
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('production_target_cannot_serve_as_preview_evidence'));
});
test('rejects immutable deployment evidence with no git ref', () => {
  const e=evidence(); delete e.deployment_identity_evidence.deployment.gitSource.ref;
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_git_ref_missing'));
});
test('rejects the same commit and branch from a different GitHub repository', () => {
  const e=evidence(); e.deployment_identity_evidence.deployment.gitSource.repoId=999999999;
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_github_repo_mismatch'));
});
test('rejects the same repository commit deployed by a different Vercel project', () => {
  const e=evidence(); e.deployment_identity_evidence.deployment.name='mirror-cartographer-fork';
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_project_name_mismatch'));
});
test('fails closed when expected repository identity is absent from the checklist', () => {
  const weakChecklist={...checklist}; delete weakChecklist.expected_deployment_identity;
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('expected_github_repo_id_missing'));
  assert.ok(result.failures.includes('expected_vercel_project_name_missing'));
});
test('rejects structurally valid deployment evidence observed outside the freshness window', () => {
  const e=evidence(); e.deployment_identity_evidence.observed_at=new Date(nowMs - 900001).toISOString();
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('deployment_evidence_stale'));
});
test('rejects a checklist that omits a deployment evidence freshness policy', () => {
  const weakChecklist={...checklist,promotion_requires:{...checklist.promotion_requires}}; delete weakChecklist.promotion_requires.max_deployment_evidence_age_ms;
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('deployment_evidence_freshness_policy_missing'));
});
test('rejects deployment evidence whose observation is after the promotion assessment', () => {
  const e=evidence(); e.deployment_identity_evidence.observed_at=new Date(nowMs + 1).toISOString();
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('deployment_evidence_observed_in_future'));
});
test('rejects a pass check without an observation timestamp', () => {
  const e=evidence(); delete e.checks.smoke.observed_at;
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_observed_at_invalid:smoke'));
});
test('rejects a pass check observed outside the freshness window', () => {
  const e=evidence(); e.checks.accessibility.observed_at=new Date(nowMs - 900001).toISOString();
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_stale:accessibility'));
});
test('rejects a pass check observed after the promotion assessment', () => {
  const e=evidence(); e.checks.rollback.observed_at=new Date(nowMs + 1).toISOString();
  const result=assess(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_observed_in_future:rollback'));
});
test('fails closed when the required-check freshness policy is absent', () => {
  const weakChecklist={...checklist,promotion_requires:{...checklist.promotion_requires}}; delete weakChecklist.promotion_requires.max_required_check_age_ms;
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_freshness_policy_missing'));
});

test('rejects an empty required-check set even when its digest matches', () => {
  const result=assess(withChecks([]), evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_checks_missing_or_empty'));
});
test('rejects duplicate required checks even when the declared profile digest matches', () => {
  const names=['build','build'];
  const result=assess(withChecks(names), evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_checks_duplicate'));
});
test('rejects non-normalized or unsafe check identifiers', () => {
  const names=['build',' Accessibility ','../rollback'];
  const result=assess(withChecks(names), evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_identifier_invalid'));
});
test('rejects an absent required-check profile', () => {
  const weakChecklist={...checklist}; delete weakChecklist.required_check_profile;
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_profile_id_missing'));
  assert.ok(result.failures.includes('required_check_profile_version_invalid'));
  assert.ok(result.failures.includes('required_check_profile_digest_missing_or_invalid'));
});
test('rejects a reduced required-check set under the prior profile digest', () => {
  const reduced=requiredChecks.filter((name)=>name !== 'accessibility');
  const weakChecklist=withChecks(reduced,{sha256:checklist.required_check_profile.sha256});
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_profile_digest_mismatch'));
});
test('rejects an unexplained profile digest mutation', () => {
  const weakChecklist=withChecks(requiredChecks,{sha256:'0'.repeat(64)});
  const result=assess(weakChecklist,evidence());
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('required_check_profile_digest_mismatch'));
});
