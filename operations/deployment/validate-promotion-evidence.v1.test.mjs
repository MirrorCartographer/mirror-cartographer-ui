import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPromotion } from './validate-promotion-evidence.v1.mjs';

const sha = 'a'.repeat(40);
const checklist = {
  source_branch: 'preview', target_branch: 'main',
  required_checks: ['build','smoke','mobile','accessibility','interaction','audio','deployment_identity','rollback','adversarial_review'],
  promotion_requires: { preview_deployment_state: 'ready' }
};
function evidence() {
  return {
    source_branch:'preview', target_branch:'main', preview_commit:sha,
    preview_url:'https://example.vercel.app', preview_deployment_state:'ready',
    deployment_commit:sha, evidence_commit:sha, unresolved_critical_risks:0,
    rollback_route_recorded:true, rollback_route:'revert '+sha,
    checks:Object.fromEntries(checklist.required_checks.map((name)=>[name,{status:'pass',commit:sha}]))
  };
}

test('accepts complete commit-bound ready evidence', () => assert.equal(assessPromotion(checklist,evidence()).promotable,true));
test('rejects canceled state', () => { const e=evidence(); e.preview_deployment_state='canceled'; assert.equal(assessPromotion(checklist,e).promotable,false); });
test('rejects check commit mismatch', () => { const e=evidence(); e.checks.smoke.commit='b'.repeat(40); assert.ok(assessPromotion(checklist,e).failures.includes('required_check_commit_mismatch:smoke')); });
test('rejects missing rollback route', () => { const e=evidence(); e.rollback_route=''; assert.ok(assessPromotion(checklist,e).failures.includes('rollback_route_missing')); });
test('rejects unresolved critical risk', () => { const e=evidence(); e.unresolved_critical_risks=1; assert.ok(assessPromotion(checklist,e).failures.includes('critical_risks_remaining')); });
