#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.build-step-log.v1';
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function sort(value){
  if(Array.isArray(value)) return value.map(sort);
  if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
const canonical = value => JSON.stringify(sort(value));
function fail(message){ throw new Error(message); }
function positiveInt(value, label, fallback){
  if(value === undefined) return fallback;
  const parsed = Number(value);
  if(!Number.isSafeInteger(parsed) || parsed <= 0) fail(`invalid ${label}`);
  return parsed;
}
function sanitizeEnv(env){
  const allowed = ['CI','LANG','LC_ALL','SOURCE_DATE_EPOCH','TZ'];
  return Object.fromEntries(allowed.filter(key => env[key] !== undefined).sort().map(key => [key, String(env[key])]));
}
function validateAdmission(admission,name,command){
  if(admission === null) return null;
  if(!admission || admission.schema !== 'fia.execution-admission.v1') fail(`invalid execution admission: ${name}`);
  if(admission.step !== name) fail(`execution admission step mismatch: ${name}`);
  if(admission.command !== sha256(Buffer.from(command))) fail(`execution admission command mismatch: ${name}`);
  if(!/^sha256:[0-9a-f]{64}$/.test(admission.admission || '')) fail(`invalid execution admission identity: ${name}`);
  const core={...admission}; delete core.admission;
  if(sha256(Buffer.from(canonical(core))) !== admission.admission) fail(`execution admission identity mismatch: ${name}`);
  return admission.admission;
}

export async function runStep({name, command, cwd='.', output, timeoutMs=300000, maxBytes=1048576, env=process.env, admission=null}){
  if(!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name || '')) fail('invalid step name');
  if(typeof command !== 'string' || !command.trim()) fail('invalid command');
  if(!output) fail('missing output path');
  const executionAdmission=validateAdmission(admission,name,command);
  timeoutMs = positiveInt(timeoutMs, 'timeout', 300000);
  maxBytes = positiveInt(maxBytes, 'max bytes', 1048576);
  const started = new Date().toISOString();
  const chunks = {stdout: [], stderr: []};
  const sizes = {stdout: 0, stderr: 0};
  let overflow = null;
  let timedOut = false;
  const child = spawn(command, {cwd, env: {...env}, shell:true, detached: process.platform !== 'win32', stdio:['ignore','pipe','pipe']});
  const terminate = () => {
    try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch {}
  };
  const collect = stream => chunk => {
    sizes[stream] += chunk.length;
    if(sizes.stdout + sizes.stderr > maxBytes){
      overflow = stream;
      terminate();
      return;
    }
    chunks[stream].push(chunk);
  };
  child.stdout.on('data', collect('stdout'));
  child.stderr.on('data', collect('stderr'));
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  clearTimeout(timer);
  const stdout = Buffer.concat(chunks.stdout);
  const stderr = Buffer.concat(chunks.stderr);
  const core = {
    schema: SCHEMA,
    step: name,
    command,
    commandSha256: sha256(Buffer.from(command)),
    executionAdmission,
    cwd: path.resolve(cwd),
    environment: sanitizeEnv(env),
    started,
    finished: new Date().toISOString(),
    exit: {code: result.code, signal: result.signal, timedOut, overflow},
    stdout: {bytes: stdout.length, sha256: sha256(stdout), text: stdout.toString('utf8')},
    stderr: {bytes: stderr.length, sha256: sha256(stderr), text: stderr.toString('utf8')}
  };
  const identityCore = {...core, started: null, finished: null};
  const record = {...core, log: sha256(Buffer.from(canonical(identityCore)))};
  await mkdir(path.dirname(output), {recursive:true});
  await writeFile(output, canonical(record)+'\n', {flag:'wx', mode:0o600});
  if(timedOut) fail(`step timed out: ${name}`);
  if(overflow) fail(`step output exceeded limit: ${name}`);
  if(result.code !== 0) fail(`step failed (${result.code ?? result.signal}): ${name}`);
  return record;
}
function args(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const token=argv[i];
    if(!token.startsWith('--')) fail(`unexpected argument: ${token}`);
    const key=token.slice(2); out[key]=argv[++i];
  }
  return {name:out.name, command:out.command, cwd:out.cwd, output:out.output, timeoutMs:out.timeout, maxBytes:out.maxBytes};
}
if(import.meta.url === `file://${process.argv[1]}`) runStep(args(process.argv.slice(2))).then(value=>console.log(canonical(value))).catch(error=>{console.error(error.message);process.exitCode=1;});
