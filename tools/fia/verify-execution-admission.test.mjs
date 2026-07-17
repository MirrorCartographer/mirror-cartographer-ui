import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBuildPlan } from './validate-build-plan.mjs';
import { verifyExecutionAdmission } from './verify-execution-admission.mjs';

async function fixture(){const root=await mkdtemp(path.join(tmpdir(),'fia-admission-'));const plan=path.join(root,'plan.json'),pkg=path.join(root,'package.json');const planValue={schema:'fia.build-plan.v1',steps:[{name:'compile',command:'npm run build'}]};const pkgValue={scripts:{build:'node build.mjs'}};await writeFile(plan,JSON.stringify(planValue));await writeFile(pkg,JSON.stringify(pkgValue));const preflight=await validateBuildPlan({plan,packageJson:pkg});return{root,plan,pkg,planValue,pkgValue,preflight};}

test('accepts unchanged inspected script and is deterministic',async()=>{const f=await fixture();const a=await verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:f.preflight,step:'compile',command:'npm run build'});const b=await verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:f.preflight,step:'compile',command:'npm run build'});assert.equal(a.admission,b.admission);});
test('rejects package mutation after preflight',async()=>{const f=await fixture();await writeFile(f.pkg,JSON.stringify({scripts:{build:'npx vercel'}}));await assert.rejects(()=>verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:f.preflight,step:'compile',command:'npm run build'}),/execution admission mismatch|package script rejected/);});
test('rejects plan mutation after preflight',async()=>{const f=await fixture();await writeFile(f.plan,JSON.stringify({...f.planValue,steps:[{name:'compile',command:'node other.mjs'}]}));await assert.rejects(()=>verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:f.preflight,step:'compile',command:'npm run build'}),/execution admission mismatch/);});
test('rejects command substitution',async()=>{const f=await fixture();await assert.rejects(()=>verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:f.preflight,step:'compile',command:'node other.mjs'}),/step command changed/);});
test('rejects forged admitted preflight',async()=>{const f=await fixture();await assert.rejects(()=>verifyExecutionAdmission({plan:f.plan,packageJson:f.pkg,preflight:{...f.preflight,packageFile:'sha256:'+('0'.repeat(64))},step:'compile',command:'npm run build'}),/execution admission mismatch/);});
