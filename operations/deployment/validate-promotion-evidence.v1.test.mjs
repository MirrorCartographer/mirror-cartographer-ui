import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPromotion } from './validate-promotion-evidence.v1.mjs';

const sha = 'a'.repeat(40);
const checklist = {
  source_branch: 'preview', target_branch: 'main',
  required_checks: ['build','smoke','mobile','accessibility','interaction','audio','deployment_identity','rollback','adversarial_review'],
  promotion_requires: { preview_deployment_state: 'ready' }
};
function immutableDeploymentEvidence() {
  const now = Date.now();
  return {
    expected_commit_sha: sha,
    observed_at: new Date(now).toISOString(),
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_Valid123', url: 'mirror-preview-abc.vercel.app', projectId: 'prj_123', name: 'mirror-cartographer-ui',
      readyState: 'READY', status: 'READY', createdAt: now - 2000, ready: now - 1000,
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
    checks:Object.fromEntries(checklist.required_checks.map((name)=>[name,{status:'pass',commit:sha}]))
  };
}

test('accepts complete commit-bound ready evidence with immutable deployment proof', () => {
  const result = assessPromotion(checklist,evidence());
  assert.equal(result.promotable,true);
  assert.equal(result.immutable_deployment_identity_verified,true);
});
test('rejects canceled state', () => { const e=evidence(); e.preview_deployment_state='canceled'; assert.equal(assessPromotion(checklist,e).promotable,false); });
test('rejects check commit mismatch', () => { const e=evidence(); e.checks.smoke.commit='b'.repeat(40); assert.ok(assessPromotion(checklist,e).failures.includes('required_check_commit_mismatch:smoke')); });
test('rejects missing rollback route', () => { const e=evidence(); e.rollback_route=''; assert.ok(assessPromotion(checklist,e).failures.includes('rollback_route_missing')); });
test('rejects unresolved critical risk', () => { const e=evidence(); e.unresolved_critical_risks=1; assert.ok(assessPromotion(checklist,e).failures.includes('critical_risks_remaining')); });
test('rejects a pass label without immutable deployment evidence', () => {
  const e=evidence(); delete e.deployment_identity_evidence;
  const result=assessPromotion(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_identity_unverified'));
});
test('rejects immutable deployment proof for another commit', () => {
  const e=evidence(); e.deployment_identity_evidence.expected_commit_sha='b'.repeat(40); e.deployment_identity_evidence.deployment.gitSource.sha='b'.repeat(40);
  const result=assessPromotion(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('immutable_deployment_expected_commit_mismatch'));
});
test('rejects an alias or unrelated HTTPS URL despite valid deployment identity', () => {
  const e=evidence(); e.preview_url='https://mirror.example.com';
  const result=assessPromotion(checklist,e);
  assert.equal(result.promotable,false);
  assert.ok(result.failures.includes('preview_url_not_immutable_deployment_hostname'));
});
test('rejects stale deployment state', () => { const e=evidence(); e.preview_deployment_state='stale'; assert.equal(assessPromotion(checklist,e).promotable,false); });
