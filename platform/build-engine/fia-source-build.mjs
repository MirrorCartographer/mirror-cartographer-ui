#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build as packageRelease } from './fia-build.mjs';

const SCHEMA = 'foundation.build.reproducibility.v1';
const POLICY = Object.freeze({
  cleanWorkspaces: 2,
  inheritHostEnvironment: false,
  providerCouplingRejected: true,
  requireEqualReleaseIdentity: true,
  providerNeutral: true,
});
const ALLOWED_ENV = new Set(['PATH', 'SYSTEMROOT', 'WINDIR']);
const PROVIDER_PATTERNS = [
  /\bvercel(?:\.app|\.com)?\b/i,
  /\bVERCEL_[A-Z0-9_]+\b/,
  /\bcloudflare\b/i,
  /\bpages\.dev\b/i,
  /\bCF_PAGES(?:_[A-Z0-9_]+)?\b/,
  /\bgithub\.io\b/i,
  /\bGITHUB_PAGES\b/,
];

function sha256(data) { return `sha256:${createHash('sha256').update(data).digest('hex')}`; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function safeRelative(rel) {
  const value = rel.normalize('NFC').replaceAll(path.sep, '/');
  if (!value || value.startsWith('/') || value.includes('\\') || value.split('/').some(s => !s || s === '.' || s === '..' || s.includes('\0'))) throw new Error(`unsafe path: ${rel}`);
  return value;
}
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function copySource(source, destination) {
  const excluded = new Set(['.git', '.fia', 'node_modules']);
  async function visit(current, rel = '') {
    await fs.mkdir(path.join(destination, rel), { recursive: true });
    const entries = (await fs.readdir(current, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for (const entry of entries) {
      if (!rel && excluded.has(entry.name)) continue;
      const childRel = safeRelative(rel ? `${rel}/${entry.name}` : entry.name);
      const src = path.join(current, entry.name); const dst = path.join(destination, childRel);
      if (entry.isSymbolicLink()) throw new Error(`source symlink rejected: ${childRel}`);
      if (entry.isDirectory()) { await visit(src, childRel); continue; }
      if (!entry.isFile()) throw new Error(`unsupported source object: ${childRel}`);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      await fs.chmod(dst, 0o644);
    }
  }
  await visit(source);
}
function buildEnvironment(extra = {}) {
  const env = {};
  for (const key of ALLOWED_ENV) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { CI:'1', TZ:'UTC', LANG:'C.UTF-8', LC_ALL:'C.UTF-8', NODE_ENV:'production', SOURCE_DATE_EPOCH:'0', HOME:'' }, extra);
  return env;
}
async function runCommand(command, cwd, env) {
  if (!Array.isArray(command) || command.length === 0 || command.some(v => typeof v !== 'string' || !v)) throw new Error('command must be a non-empty string array');
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, env, stdio:['ignore','pipe','pipe'], shell:false });
    const stdout=[]; const stderr=[];
    child.stdout.on('data', chunk => stdout.push(chunk)); child.stderr.on('data', chunk => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout:Buffer.concat(stdout), stderr:Buffer.concat(stderr) }));
  });
}
async function scanProviderCoupling(root) {
  async function visit(dir) {
    const entries = await fs.readdir(dir,{withFileTypes:true});
    for (const entry of entries) {
      const abs=path.join(dir,entry.name);
      if (entry.isSymbolicLink()) throw new Error(`output symlink rejected: ${abs}`);
      if (entry.isDirectory()) { await visit(abs); continue; }
      if (!entry.isFile()) throw new Error(`unsupported output object: ${abs}`);
      const bytes=await fs.readFile(abs);
      if (bytes.includes(0)) continue;
      const text=bytes.toString('utf8');
      for (const pattern of PROVIDER_PATTERNS) if (pattern.test(text)) throw new Error(`provider coupling detected in ${path.relative(root,abs)}: ${pattern}`);
    }
  }
  await visit(root);
}
async function oneRun({source, command, dist, sourceIdentity, tempRoot, run}) {
  const workspace=path.join(tempRoot,`workspace-${run}`); await fs.mkdir(workspace,{recursive:true}); await copySource(source,workspace);
  const result=await runCommand(command,workspace,buildEnvironment());
  if (result.code !== 0) throw Object.assign(new Error(`build command failed in run ${run} with code ${result.code}${result.signal?` signal ${result.signal}`:''}`),{runResult:result});
  const distPath=path.resolve(workspace,dist); if (!await exists(distPath)) throw new Error(`build command succeeded without declared output: ${dist}`);
  await scanProviderCoupling(distPath);
  const releasePath=path.join(tempRoot,`release-${run}`);
  const manifest=await packageRelease({input:distPath,output:releasePath,sourceIdentity});
  return {result,manifest,releasePath};
}
export async function compileSource({source, output, command, dist='dist', sourceIdentity='unversioned'}) {
  const sourceRoot=path.resolve(source); const outputRoot=path.resolve(output);
  if (await exists(outputRoot)) throw new Error(`output exists: ${outputRoot}`);
  await fs.access(sourceRoot);
  const tempRoot=await fs.mkdtemp(path.join(os.tmpdir(),'fia-source-build-'));
  let first, second;
  try {
    first=await oneRun({source:sourceRoot,command,dist,sourceIdentity,tempRoot,run:1});
    second=await oneRun({source:sourceRoot,command,dist,sourceIdentity,tempRoot,run:2});
    if (first.manifest.releaseIdentity !== second.manifest.releaseIdentity) throw new Error(`reproducibility mismatch: ${first.manifest.releaseIdentity} != ${second.manifest.releaseIdentity}`);
    const authority={schema:SCHEMA,sourceIdentity,command,dist,releaseIdentity:first.manifest.releaseIdentity,runs:[first,second].map((r,i)=>({run:i+1,stdoutSha256:sha256(r.result.stdout),stderrSha256:sha256(r.result.stderr),exitCode:r.result.code,signal:r.result.signal,releaseIdentity:r.manifest.releaseIdentity})),policy:POLICY};
    const contentIdentity=sha256(Buffer.from(canonical(authority)));
    const stage=`${outputRoot}.tmp-${process.pid}`; await fs.mkdir(stage,{recursive:true});
    await fs.cp(first.releasePath,path.join(stage,'release'),{recursive:true,errorOnExist:true});
    await fs.writeFile(path.join(stage,'build-1.stdout.log'),first.result.stdout,{flag:'wx'}); await fs.writeFile(path.join(stage,'build-1.stderr.log'),first.result.stderr,{flag:'wx'});
    await fs.writeFile(path.join(stage,'build-2.stdout.log'),second.result.stdout,{flag:'wx'}); await fs.writeFile(path.join(stage,'build-2.stderr.log'),second.result.stderr,{flag:'wx'});
    const evidence={...authority,contentIdentity}; await fs.writeFile(path.join(stage,'reproducibility.json'),`${canonical(evidence)}\n`,{flag:'wx',mode:0o444});
    await fs.rename(stage,outputRoot); return evidence;
  } finally { await fs.rm(tempRoot,{recursive:true,force:true}); }
}
async function cli(){ const args=process.argv.slice(2); const get=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined}; const source=get('--source'),output=get('--output'),dist=get('--dist')||'dist',sourceIdentity=get('--sourceIdentity')||'unversioned'; const separator=args.indexOf('--'); const command=separator>=0?args.slice(separator+1):[]; if(!source||!output||!command.length) throw new Error('usage: fia-source-build --source <dir> --output <dir> [--dist dist] [--sourceIdentity id] -- <command> [args...]'); const result=await compileSource({source,output,command,dist,sourceIdentity}); process.stdout.write(`${result.contentIdentity}\n`); }
if(import.meta.url===`file://${process.argv[1]}`) cli().catch(error=>{console.error(error.message);process.exitCode=1;});
