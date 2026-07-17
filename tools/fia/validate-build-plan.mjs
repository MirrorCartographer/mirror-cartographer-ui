#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PLAN_SCHEMA = 'fia.build-plan.v1';
const ATTESTATION_SCHEMA = 'fia.build-plan-preflight.v1';
const POLICY_SCHEMA = 'fia.build-plan-policy.v1';
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function sort(value){
  if(Array.isArray(value)) return value.map(sort);
  if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
const canonical = value => JSON.stringify(sort(value));
function fail(message){ throw new Error(message); }

export const DEFAULT_POLICY = Object.freeze({
  schema: POLICY_SCHEMA,
  version: 1,
  providerTokens: ['cloudflare','firebase','gh-pages','github-pages','netlify','pages.cloudflare.com','surge','vercel','wrangler'],
  networkExecutables: ['curl','ftp','http','https','nc','netcat','scp','sftp','ssh','telnet','wget'],
  publicationRules: [
    {executable:'git', verbs:['push']},
    {executable:'gh', verbs:['pr','release','workflow']},
    {executable:'docker', verbs:['push']},
    {executable:'podman', verbs:['push']},
    {executable:'kubectl', verbs:['apply','create','delete','patch','replace','rollout','scale','set']}
  ],
  forbiddenShellTokens: ['`','$(','${!'],
  packageRules: {
    npm: {forbidden:['add','i','install','update','upgrade'], allowedInstall:['ci']},
    pnpm: {forbidden:['add','install','update','upgrade'], requiredFlags:['--frozen-lockfile','--offline']},
    yarn: {forbidden:['add','install','up','upgrade'], requiredFlags:['--immutable','--offline']},
    npx: {forbidden:['*']}
  }
});

function tokenize(command){
  const tokens=[];
  let token='', quote=null, escaped=false;
  for(const char of command){
    if(escaped){ token += char; escaped=false; continue; }
    if(char === '\\' && quote !== "'"){ escaped=true; continue; }
    if(quote){ if(char===quote) quote=null; else token+=char; continue; }
    if(char==='"' || char==="'"){ quote=char; continue; }
    if(/\s/.test(char) || [';','|','&'].includes(char)){
      if(token){ tokens.push(token); token=''; }
      if([';','|'].includes(char)) tokens.push(char);
      continue;
    }
    token += char;
  }
  if(quote) fail('unterminated quote in build command');
  if(escaped) token += '\\';
  if(token) tokens.push(token);
  return tokens;
}

function basename(token){ return path.posix.basename(token.replace(/\\/g,'/')).toLowerCase(); }
function commandSegments(tokens){
  const result=[]; let current=[];
  for(const token of tokens){
    if(token===';' || token==='|') { if(current.length) result.push(current); current=[]; }
    else current.push(token);
  }
  if(current.length) result.push(current);
  return result;
}
function firstExecutable(segment){
  let i=0;
  while(i<segment.length && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(segment[i])) i++;
  return {executable: basename(segment[i] || ''), args: segment.slice(i+1).map(value=>value.toLowerCase())};
}
function firstVerb(args){ return args.find(value => !value.startsWith('-')) || ''; }

export function inspectCommand(command, policy=DEFAULT_POLICY){
  if(typeof command !== 'string' || !command.trim()) fail('invalid build command');
  const lower=command.toLowerCase();
  const findings=[];
  for(const token of policy.providerTokens){
    if(lower.includes(token)) findings.push({code:'provider-coupling', detail:token});
  }
  for(const token of policy.forbiddenShellTokens){
    if(command.includes(token)) findings.push({code:'dynamic-shell-expansion', detail:token});
  }
  const tokens=tokenize(command);
  for(const segment of commandSegments(tokens)){
    const {executable,args}=firstExecutable(segment);
    if(!executable) continue;
    if(policy.networkExecutables.includes(executable)) findings.push({code:'network-command', detail:executable});
    for(const rule of policy.publicationRules){
      if(executable===rule.executable && rule.verbs.includes(firstVerb(args))) findings.push({code:'publication-command', detail:`${executable} ${firstVerb(args)}`});
    }
    const packageRule=policy.packageRules[executable];
    if(packageRule){
      const verb=firstVerb(args);
      if(packageRule.forbidden?.includes('*')) findings.push({code:'mutable-package-executor', detail:executable});
      else if(packageRule.forbidden?.includes(verb)){
        const allowed=packageRule.allowedInstall?.includes(verb);
        const hasRequired=packageRule.requiredFlags?.every(flag=>args.includes(flag));
        if(!allowed && !hasRequired) findings.push({code:'mutable-dependency-command', detail:`${executable} ${verb}`});
      }
    }
  }
  return [...new Map(findings.map(item=>[`${item.code}\0${item.detail}`,item])).values()];
}

function validateStructure(plan){
  if(plan?.schema!==PLAN_SCHEMA || !Array.isArray(plan.steps) || plan.steps.length===0) fail('unsupported or empty build plan');
  const names=new Set();
  for(const [index,step] of plan.steps.entries()){
    if(!step || typeof step!=='object' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(step.name||'')) fail(`invalid plan step at index ${index}`);
    if(names.has(step.name)) fail(`duplicate plan step: ${step.name}`);
    names.add(step.name);
    if(step.required===false) fail(`optional steps are unsupported: ${step.name}`);
    if(typeof step.command!=='string' || !step.command.trim()) fail(`missing command for step: ${step.name}`);
  }
}

export async function validateBuildPlan({plan:planPath, output=null, policy=DEFAULT_POLICY}){
  if(!planPath) fail('missing build plan');
  const bytes=await readFile(planPath);
  let plan;
  try { plan=JSON.parse(bytes); } catch { fail('invalid build plan JSON'); }
  validateStructure(plan);
  const rejected=[];
  for(const step of plan.steps){
    for(const finding of inspectCommand(step.command,policy)) rejected.push({step:step.name,...finding});
  }
  if(rejected.length) fail(`build plan rejected: ${rejected.map(item=>`${item.step}:${item.code}:${item.detail}`).join(', ')}`);
  const policyIdentity=sha256(Buffer.from(canonical(policy)));
  const core={schema:ATTESTATION_SCHEMA,plan:sha256(Buffer.from(canonical(plan))),planFile:sha256(bytes),policy:policyIdentity,status:'accepted',steps:plan.steps.map(step=>({name:step.name,command:sha256(Buffer.from(step.command))}))};
  const record={...core,preflight:sha256(Buffer.from(canonical(core)))};
  if(output){ await mkdir(path.dirname(output),{recursive:true}); await writeFile(output,canonical(record)+'\n',{flag:'wx',mode:0o600}); }
  return record;
}

function args(argv){ const out={}; for(let i=0;i<argv.length;i++){const token=argv[i];if(!token.startsWith('--'))fail(`unexpected argument: ${token}`);out[token.slice(2)]=argv[++i];}return{plan:out.plan,output:out.output??null}; }
if(import.meta.url===`file://${process.argv[1]}`) validateBuildPlan(args(process.argv.slice(2))).then(value=>console.log(canonical(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
