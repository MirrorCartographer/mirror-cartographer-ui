#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PLAN_SCHEMA = 'fia.provider-neutral-build-plan.v1';
const RUN_SCHEMA = 'fia.provider-neutral-build-run.v1';
const MAX_LOG_BYTES = 4 * 1024 * 1024;

function fail(message) { throw new Error(message); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}
function normalizeRel(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty relative path`);
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) fail(`${label} must not escape the workspace`);
  return normalized;
}
async function readJson(file, label) {
  let bytes;
  try { bytes = await readFile(file); } catch { fail(`${label} is not readable`); }
  try { return { bytes, value: JSON.parse(bytes) }; } catch { fail(`${label} is not valid JSON`); }
}
function verifyPlan(plan) {
  if (plan.schema !== PLAN_SCHEMA) fail('unsupported build plan schema');
  if (typeof plan.identity !== 'string' || !/^[a-f0-9]{64}$/.test(plan.identity)) fail('build plan identity is invalid');
  const { identity, ...material } = plan;
  if (sha256(canonical(material)) !== identity) fail('build plan identity mismatch');
  if (plan.policy?.hostedBuildAuthority !== false || plan.policy?.networkRequired !== false) fail('build plan policy is not provider-neutral');
  return identity;
}
async function inventoryEntry(root, relative) {
  const absolute = path.join(root, relative);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) fail(`symbolic links are forbidden: ${relative}`);
  if (info.isDirectory()) return { path: relative.replaceAll('\\', '/'), type: 'directory', mode: info.mode & 0o777 };
  if (!info.isFile()) fail(`unsupported filesystem entry: ${relative}`);
  const bytes = await readFile(absolute);
  return { path: relative.replaceAll('\\', '/'), type: 'file', mode: info.mode & 0o777, bytes: bytes.length, sha256: sha256(bytes) };
}
async function inventoryTree(root) {
  const entries = [];
  async function walk(relative) {
    const absolute = relative ? path.join(root, relative) : root;
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) fail(`symbolic links are forbidden: ${relative || '.'}`);
    if (!info.isDirectory()) fail('inventory root must be a directory');
    if (relative) entries.push({ path: relative.replaceAll('\\', '/'), type: 'directory', mode: info.mode & 0o777 });
    const names = (await readdir(absolute)).sort();
    for (const name of names) {
      const child = relative ? path.join(relative, name) : name;
      const childInfo = await lstat(path.join(root, child));
      if (childInfo.isDirectory()) await walk(child);
      else entries.push(await inventoryEntry(root, child));
    }
  }
  await walk('');
  return entries;
}
function inventoryIdentity(entries) { return sha256(canonical(entries)); }
async function copyAdmittedInputs(source, workspace, inputs) {
  for (const raw of inputs) {
    const relative = normalizeRel(raw, 'input');
    const from = path.join(source, relative);
    const to = path.join(workspace, relative);
    const sourceInfo = await lstat(from).catch(() => null);
    if (!sourceInfo) fail(`admitted input is missing: ${relative}`);
    if (sourceInfo.isSymbolicLink()) fail(`symbolic links are forbidden: ${relative}`);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  }
}
function buildEnvironment(allowlist, hostEnv, workspace) {
  const env = {};
  for (const name of allowlist) if (hostEnv[name] !== undefined) env[name] = hostEnv[name];
  env.HOME = path.join(workspace, '.fia-home');
  env.TMPDIR = path.join(workspace, '.fia-tmp');
  env.TMP = env.TMPDIR;
  env.TEMP = env.TMPDIR;
  env.npm_config_audit = 'false';
  env.npm_config_fund = 'false';
  env.npm_config_update_notifier = 'false';
  env.HTTP_PROXY = 'http://127.0.0.1:9';
  env.HTTPS_PROXY = 'http://127.0.0.1:9';
  env.ALL_PROXY = 'http://127.0.0.1:9';
  env.NO_PROXY = '';
  return env;
}
function capture(stream, limit = MAX_LOG_BYTES) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  stream.on('data', chunk => {
    const buffer = Buffer.from(chunk);
    const remaining = limit - bytes;
    if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
    bytes += Math.min(buffer.length, Math.max(remaining, 0));
    if (buffer.length > remaining) truncated = true;
  });
  return () => ({ bytes: Buffer.concat(chunks), truncated });
}
async function execute({ cwd, buildScript, env, timeoutMs, spawnImpl = spawn }) {
  return await new Promise((resolve, reject) => {
    const child = spawnImpl('npm', ['run', '--silent', buildScript], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const stdoutResult = capture(child.stdout);
    const stderrResult = capture(child.stderr);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      const stdout = stdoutResult();
      const stderr = stderrResult();
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}
function removeOutputEntries(entries, output) {
  return entries.filter(entry => entry.path !== output && !entry.path.startsWith(`${output}/`) && !entry.path.startsWith('.fia-home') && !entry.path.startsWith('.fia-tmp'));
}
export async function runProviderNeutralBuild({ planPath, packagePath, sourcePath, attempts = 2, timeoutMs = 300000, spawnImpl = spawn, hostEnv = process.env }) {
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 8) fail('attempts must be an integer from 2 through 8');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3600000) fail('timeoutMs must be between 100 and 3600000');
  const [{ bytes: planBytes, value: plan }, packageBytes] = await Promise.all([readJson(planPath, 'build plan'), readFile(packagePath)]);
  verifyPlan(plan);
  if (sha256(packageBytes) !== plan.package?.sha256 || packageBytes.length !== plan.package?.bytes) fail('package.json does not match admitted build plan');
  const source = path.resolve(sourcePath);
  const output = normalizeRel(plan.output, 'output');
  const runs = [];
  let expectedArtifactIdentity = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const workspaceRoot = path.join(os.tmpdir(), 'fia-provider-neutral-builds');
    await mkdir(workspaceRoot, { recursive: true });
    const workspace = await mkdtemp(path.join(workspaceRoot, 'attempt-'));
    try {
      await copyAdmittedInputs(source, workspace, plan.inputs);
      const admittedPackage = path.join(workspace, 'package.json');
      const copiedPackageBytes = await readFile(admittedPackage).catch(() => null);
      if (!copiedPackageBytes || sha256(copiedPackageBytes) !== plan.package.sha256) fail('admitted inputs do not contain the planned package.json');
      const outputPath = path.join(workspace, output);
      if (await stat(outputPath).then(() => true).catch(() => false)) fail('declared output exists before build');
      await mkdir(path.join(workspace, '.fia-home'), { recursive: true });
      await mkdir(path.join(workspace, '.fia-tmp'), { recursive: true });
      const before = removeOutputEntries(await inventoryTree(workspace), output);
      const env = buildEnvironment(plan.envAllowlist ?? [], hostEnv, workspace);
      const result = await execute({ cwd: workspace, buildScript: plan.buildScript, env, timeoutMs, spawnImpl });
      if (result.timedOut) fail(`build timed out at attempt ${attempt}`);
      if (result.code !== 0) fail(`build failed at attempt ${attempt} with exit code ${result.code}`);
      const afterAll = await inventoryTree(workspace);
      const after = removeOutputEntries(afterAll, output);
      if (canonical(before) !== canonical(after)) fail(`build mutated admitted inputs or wrote outside output at attempt ${attempt}`);
      const artifactInfo = await lstat(outputPath).catch(() => null);
      if (!artifactInfo?.isDirectory()) fail(`declared output was not produced at attempt ${attempt}`);
      const artifactEntries = await inventoryTree(outputPath);
      if (!artifactEntries.some(entry => entry.type === 'file')) fail(`declared output contains no files at attempt ${attempt}`);
      const artifactIdentity = inventoryIdentity(artifactEntries);
      if (expectedArtifactIdentity && artifactIdentity !== expectedArtifactIdentity) fail(`artifact divergence at attempt ${attempt}`);
      expectedArtifactIdentity ??= artifactIdentity;
      runs.push({
        attempt,
        artifactIdentity,
        artifactEntries,
        exitCode: result.code,
        signal: result.signal,
        logs: {
          stdout: { sha256: sha256(result.stdout.bytes), bytes: result.stdout.bytes.length, truncated: result.stdout.truncated },
          stderr: { sha256: sha256(result.stderr.bytes), bytes: result.stderr.bytes.length, truncated: result.stderr.truncated }
        }
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
  const identityMaterial = {
    schema: RUN_SCHEMA,
    plan: { identity: plan.identity, sha256: sha256(planBytes), bytes: planBytes.length },
    package: { sha256: sha256(packageBytes), bytes: packageBytes.length },
    attempts,
    timeoutMs,
    artifactIdentity: expectedArtifactIdentity,
    artifactEntries: runs[0].artifactEntries,
    policy: {
      cleanWorkspaces: true,
      environmentAllowlistOnly: true,
      advisoryNetworkDenial: true,
      kernelNetworkDenial: false,
      admittedInputsImmutable: true,
      undeclaredWritesRejected: true,
      independentArtifactComparison: true,
      overwriteExistingEvidence: false
    }
  };
  return { ...identityMaterial, runs, identity: sha256(canonical(identityMaterial)) };
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.plan || !args.package || !args.source || !args.output) fail('usage: --plan plan.json --package package.json --source . --output run.json [--attempts 2] [--timeoutMs 300000]');
  await access(path.dirname(path.resolve(args.output)), fsConstants.W_OK);
  const record = await runProviderNeutralBuild({
    planPath: args.plan,
    packagePath: args.package,
    sourcePath: args.source,
    attempts: args.attempts ? Number(args.attempts) : 2,
    timeoutMs: args.timeoutMs ? Number(args.timeoutMs) : 300000
  });
  const handle = await open(args.output, 'wx');
  try { await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`); } finally { await handle.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
