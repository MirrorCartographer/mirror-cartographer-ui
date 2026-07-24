#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const canonical = (v) => Array.isArray(v)
  ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
    : JSON.stringify(v);

function fail(message) { throw new Error(message); }
function inside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`path escapes workspace: ${candidate}`);
}
function walk(root) {
  const files = [];
  const visit = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) fail(`symlink rejected: ${full}`);
      if (st.isDirectory()) visit(full);
      else if (st.isFile()) files.push(full);
    }
  };
  visit(root);
  return files;
}
function inventory(root) {
  return walk(root).map(file => {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const st = fs.statSync(file);
    return { path: rel, bytes: st.size, mode: st.mode & 0o777, sha256: sha256(fs.readFileSync(file)) };
  });
}
function normalizedEnv(extra = {}) {
  const keep = ['PATH'];
  const env = Object.fromEntries(keep.filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, {
    CI: 'true', TZ: 'UTC', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
    SOURCE_DATE_EPOCH: '0', HOME: '/tmp/fia-worker-home',
    VERCEL: '', CF_PAGES: '', GITHUB_ACTIONS: ''
  }, extra);
  return env;
}
export function runJob(jobPath) {
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  for (const key of ['schema','job_id','workspace','command','outputs','source_digest']) if (!(key in job)) fail(`missing ${key}`);
  if (job.schema !== 'fia.worker-job.v1') fail('unsupported schema');
  if (!/^sha256:[a-f0-9]{64}$/.test(job.source_digest)) fail('invalid source digest');
  if (!Array.isArray(job.command) || !job.command.length || job.command.some(x => typeof x !== 'string')) fail('command must be a non-empty string array');
  if (!Array.isArray(job.outputs) || job.outputs.some(x => typeof x !== 'string')) fail('outputs must be string paths');
  const workspace = path.resolve(path.dirname(jobPath), job.workspace);
  if (!fs.existsSync(workspace)) fail('workspace missing');
  for (const output of job.outputs) inside(workspace, path.resolve(workspace, output));
  const start = Date.now();
  const result = spawnSync(job.command[0], job.command.slice(1), {
    cwd: workspace,
    env: normalizedEnv(job.env || {}),
    encoding: 'utf8',
    timeout: Math.min(job.timeout_ms || 300000, 900000),
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.status !== 0) fail(`job failed with exit code ${result.status}`);
  const outputInventory = [];
  for (const output of job.outputs) {
    const full = path.resolve(workspace, output);
    if (!fs.existsSync(full)) fail(`declared output missing: ${output}`);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) fail(`output symlink rejected: ${output}`);
    if (st.isDirectory()) {
      for (const item of inventory(full)) outputInventory.push({...item, path: `${output}/${item.path}`});
    } else {
      outputInventory.push({path: output, bytes: st.size, mode: st.mode & 0o777, sha256: sha256(fs.readFileSync(full))});
    }
  }
  outputInventory.sort((a,b) => a.path.localeCompare(b.path));
  const receipt = {
    schema: 'fia.worker-receipt.v1',
    job_id: job.job_id,
    source_digest: job.source_digest,
    command: job.command,
    environment: { CI:'true', TZ:'UTC', LANG:'C.UTF-8', LC_ALL:'C.UTF-8', SOURCE_DATE_EPOCH:'0' },
    exit_code: result.status,
    signal: result.signal,
    timed_out: result.error?.code === 'ETIMEDOUT',
    stdout_sha256: sha256(Buffer.from(result.stdout || '')),
    stderr_sha256: sha256(Buffer.from(result.stderr || '')),
    outputs: outputInventory,
    duration_ms: Date.now() - start
  };
  const stable = {...receipt, duration_ms: 0};
  receipt.receipt_digest = `sha256:${sha256(Buffer.from(canonical(stable)))}`;
  const receiptPath = path.resolve(workspace, job.receipt || 'fia-worker-receipt.json');
  inside(workspace, receiptPath);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try { console.log(JSON.stringify(runJob(path.resolve(process.argv[2])), null, 2)); }
  catch (error) { console.error(error.message); process.exit(1); }
}
