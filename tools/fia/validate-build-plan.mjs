#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PLAN_SCHEMA='fia.build-plan.v1';
const ATTESTATION_SCHEMA='fia.build-plan-preflight.v2';
const POLICY_SCHEMA='fia.build-plan-policy.v2';
const sha256=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
const canonical=v=>JSON.stringify(sort(v));
function fail(m){throw new Error(m);}

export const DEFAULT_POLICY=Object.freeze({
 schema:POLICY_SCHEMA,version:2,
 providerTokens:['cloudflare','firebase','gh-pages','github-pages','netlify','pages.cloudflare.com','surge','vercel','wrangler'],
 networkExecutables:['curl','ftp','http','https','nc','netcat','scp','sftp','ssh','telnet','wget'],
 publicationRules:[{executable:'git',verbs:['push']},{executable:'gh',verbs:['pr','release','workflow']},{executable:'docker',verbs:['push']},{executable:'podman',verbs:['push']},{executable:'kubectl',verbs:['apply','create','delete','patch','replace','rollout','scale','set']}],
 forbiddenShellTokens:['`','$(','${!'],
 packageRules:{npm:{forbidden:['add','i','install','update','upgrade'],allowedInstall:['ci']},pnpm:{forbidden:['add','install','update','upgrade'],requiredFlags:['--frozen-lockfile','--offline']},yarn:{forbidden:['add','install','up','upgrade'],requiredFlags:['--immutable','--offline']},npx:{forbidden:['*']}},
 lifecycleHooks:'reject'
});

function tokenize(command){const tokens=[];let token='',quote=null,escaped=false;for(const char of command){if(escaped){token+=char;escaped=false;continue;}if(char==='\\'&&quote!=="'"){escaped=true;continue;}if(quote){if(char===quote)quote=null;else token+=char;continue;}if(char==='"'||char==="'"){quote=char;continue;}if(/\s/.test(char)||[';','|','&'].includes(char)){if(token){tokens.push(token);token='';}if([';','|','&'].includes(char))tokens.push(char);continue;}token+=char;}if(quote)fail('unterminated quote in build command');if(escaped)token+='\\';if(token)tokens.push(token);return tokens;}
const basename=t=>path.posix.basename(t.replace(/\\/g,'/')).toLowerCase();
function segments(tokens){const out=[];let cur=[];for(const t of tokens){if(t===';'||t==='|'||t==='&'){if(cur.length)out.push(cur);cur=[];}else cur.push(t);}if(cur.length)out.push(cur);return out;}
function executable(segment){let i=0;while(i<segment.length&&/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(segment[i]))i++;return{executable:basename(segment[i]||''),args:segment.slice(i+1)};}
const firstVerb=args=>args.find(v=>!v.startsWith('-'))||'';

export function inspectCommand(command,policy=DEFAULT_POLICY){if(typeof command!=='string'||!command.trim())fail('invalid build command');const lower=command.toLowerCase(),findings=[];for(const token of policy.providerTokens)if(lower.includes(token))findings.push({code:'provider-coupling',detail:token});for(const token of policy.forbiddenShellTokens)if(command.includes(token))findings.push({code:'dynamic-shell-expansion',detail:token});for(const seg of segments(tokenize(command))){const {executable:exe,args:raw}=executable(seg),args=raw.map(v=>v.toLowerCase());if(!exe)continue;if(policy.networkExecutables.includes(exe))findings.push({code:'network-command',detail:exe});for(const rule of policy.publicationRules)if(exe===rule.executable&&rule.verbs.includes(firstVerb(args)))findings.push({code:'publication-command',detail:`${exe} ${firstVerb(args)}`});const r=policy.packageRules[exe];if(r){const verb=firstVerb(args);if(r.forbidden?.includes('*'))findings.push({code:'mutable-package-executor',detail:exe});else if(r.forbidden?.includes(verb)){const allowed=r.allowedInstall?.includes(verb),required=r.requiredFlags?.every(f=>args.includes(f));if(!allowed&&!required)findings.push({code:'mutable-dependency-command',detail:`${exe} ${verb}`});}}}return[...new Map(findings.map(x=>[`${x.code}\0${x.detail}`,x])).values()];}

function runTarget(segment){const {executable:exe,args}=executable(segment);if(!['npm','pnpm','yarn'].includes(exe))return null;const lowered=args.map(v=>v.toLowerCase());let i=0;if(lowered[i]==='run'||lowered[i]==='run-script')i++;else if(exe==='yarn'&&lowered[i]&&!lowered[i].startsWith('-')&&!['install','add','up','upgrade'].includes(lowered[i])){}else return null;while(i<args.length&&args[i].startsWith('-'))i++;return args[i]||null;}
function referencedScripts(command){const refs=[];for(const seg of segments(tokenize(command))){const target=runTarget(seg);if(target)refs.push(target);}return refs;}
function validateStructure(plan){if(plan?.schema!==PLAN_SCHEMA||!Array.isArray(plan.steps)||!plan.steps.length)fail('unsupported or empty build plan');const names=new Set();for(const [i,s] of plan.steps.entries()){if(!s||typeof s!=='object'||!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(s.name||''))fail(`invalid plan step at index ${i}`);if(names.has(s.name))fail(`duplicate plan step: ${s.name}`);names.add(s.name);if(s.required===false)fail(`optional steps are unsupported: ${s.name}`);if(typeof s.command!=='string'||!s.command.trim())fail(`missing command for step: ${s.name}`);}}

function resolveScript(name,scripts,policy,stack=[],resolved=[]){if(stack.includes(name))fail(`script cycle: ${[...stack,name].join(' -> ')}`);if(!(name in scripts))fail(`missing package script: ${name}`);for(const hook of [`pre${name}`,`post${name}`])if(hook in scripts&&policy.lifecycleHooks==='reject')fail(`unauthorized lifecycle hook: ${hook}`);const command=scripts[name];const findings=inspectCommand(command,policy);if(findings.length)fail(`package script rejected: ${name}:${findings.map(x=>`${x.code}:${x.detail}`).join(',')}`);const node={name,command,commandIdentity:sha256(Buffer.from(command)),references:[]};resolved.push(node);for(const ref of referencedScripts(command)){node.references.push(ref);resolveScript(ref,scripts,policy,[...stack,name],resolved);}return node;}

export async function validateBuildPlan({plan:planPath,output=null,packageJson='package.json',policy=DEFAULT_POLICY}){if(!planPath)fail('missing build plan');const [planBytes,pkgBytes]=await Promise.all([readFile(planPath),readFile(packageJson)]);let plan,pkg;try{plan=JSON.parse(planBytes);}catch{fail('invalid build plan JSON');}try{pkg=JSON.parse(pkgBytes);}catch{fail('invalid package.json JSON');}validateStructure(plan);const scripts=pkg?.scripts&&typeof pkg.scripts==='object'?pkg.scripts:{};const rejected=[],resolved=[];for(const step of plan.steps){for(const f of inspectCommand(step.command,policy))rejected.push({step:step.name,...f});for(const ref of referencedScripts(step.command)){const nodes=[];resolveScript(ref,scripts,policy,[],nodes);resolved.push({step:step.name,root:ref,scripts:nodes});}}if(rejected.length)fail(`build plan rejected: ${rejected.map(x=>`${x.step}:${x.code}:${x.detail}`).join(', ')}`);const core={schema:ATTESTATION_SCHEMA,plan:sha256(Buffer.from(canonical(plan))),planFile:sha256(planBytes),packageFile:sha256(pkgBytes),packageScripts:sha256(Buffer.from(canonical(scripts))),policy:sha256(Buffer.from(canonical(policy))),status:'accepted',steps:plan.steps.map(s=>({name:s.name,command:sha256(Buffer.from(s.command))})),resolvedScripts:resolved};const record={...core,preflight:sha256(Buffer.from(canonical(core)))};if(output){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,canonical(record)+'\n',{flag:'wx',mode:0o600});}return record;}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))fail(`unexpected argument: ${t}`);o[t.slice(2)]=argv[++i];}return{plan:o.plan,output:o.output??null,packageJson:o.package??'package.json'};}
if(import.meta.url===`file://${process.argv[1]}`)validateBuildPlan(args(process.argv.slice(2))).then(v=>console.log(canonical(v))).catch(e=>{console.error(e.message);process.exitCode=1;});
