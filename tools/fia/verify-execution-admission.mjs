#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { validateBuildPlan } from './validate-build-plan.mjs';

const SCHEMA='fia.execution-admission.v1';
const sha256=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
const canonical=v=>JSON.stringify(sort(v));
function fail(m){throw new Error(m);}
const validIdentity=v=>/^sha256:[0-9a-f]{64}$/.test(v||'');

export async function verifyExecutionAdmission({plan,packageJson='package.json',preflight,step,command}){
 if(!plan)fail('missing build plan');
 if(!preflight||preflight.schema!=='fia.build-plan-preflight.v2'||!validIdentity(preflight.preflight))fail('invalid admitted preflight');
 if(!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(step||''))fail('invalid step name');
 if(typeof command!=='string'||!command.trim())fail('invalid step command');
 const fresh=await validateBuildPlan({plan,packageJson,output:null});
 for(const key of ['preflight','plan','planFile','packageFile','packageScripts','policy'])if(fresh[key]!==preflight[key])fail(`execution admission mismatch: ${key}`);
 const admittedStep=fresh.steps.find(item=>item.name===step);
 if(!admittedStep)fail(`step absent from admitted plan: ${step}`);
 const commandIdentity=sha256(Buffer.from(command));
 if(admittedStep.command!==commandIdentity)fail(`step command changed after preflight: ${step}`);
 const core={schema:SCHEMA,step,command:commandIdentity,preflight:fresh.preflight,planFile:fresh.planFile,packageFile:fresh.packageFile,packageScripts:fresh.packageScripts,status:'accepted'};
 return {...core,admission:sha256(Buffer.from(canonical(core)))};
}
