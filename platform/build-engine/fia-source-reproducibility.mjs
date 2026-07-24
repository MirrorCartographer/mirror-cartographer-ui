#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCHEMA = 'foundation.build.reproducibility.v1';
const POLICY = Object.freeze({ cleanWorkspaces: 2, providerNeutral: true, rejectSymlinks: true, rejectProviderCoupling: true, deterministicEnvironment: true, failClosed: true });
const PROVIDER_MARKERS = [/vercel(?:\.app|\.com)?/i, /\bVERCEL_[A-Z0-9_]+\b/, /cloudflare/i, /pages\.dev/i, /\bCF_PAGES[A-Z0-9_]*\b/, /github\.io/i, /\bGITHUB_PAGES\b/];

function sha256(data) { return `sha256:${createHash('sha256').update(data).digest('hex')}`; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function safeRelative(rel) {
  const normalized = rel.normalize('NFC').replaceAll(path.sep, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\\') || normalized.split('/').some(s => !s || s === '.' || s === '..' || s.includes('\0'))) throw new Error(`unsafe path: ${rel}`);
  return normalized;
}
async function inventory(root) {
  const files = [], seen = new Set();
  async function visit(dir) {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name), rel = safeRelative(path.relative(root, abs)), folded = rel.toLocaleLowerCase('en-US');
      if (seen.has(folded)) throw new Error(`case-fold collision: ${rel}`);
      seen.add(folded);
      if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (entry.isDirectory()) await visit(abs);
      else if (entry.isFile()) { const bytes = await fs.readFile(abs); files.push({ path: rel, size: bytes.length, sha256: sha256(bytes) }); }
      else throw new Error(`unsupported filesystem object: ${rel}`);
    }
  }
  await visit(root); files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { files, identity: sha256(Buffer.from(canonical(files))) };
}
async function copySource(source, target) {
  await fs.mkdir(target, { recursive: true });
  async function visit(src, dst, relBase = '') {
    const entries = (await fs.readdir(src, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (!relBase && ['.git', '.fia', 'node_modules'].includes(entry.name)) continue;
      const srcPath = path.join(src, entry.name), dstPath = path.join(dst, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`source symlink rejected: ${path.join(relBase, entry.name)}`);
      if (entry.isDirectory()) { await fs.mkdir(dstPath, { recursive: true }); await visit(srcPath, dstPath, path.join(relBase, entry.name)); }
      else if (entry.isFile()) await fs.copyFile(srcPath, dstPath);
      else throw new Error(`unsupported source object: ${path.join(relBase, entry.name)}`);
    }
  }
  await visit(source, target);
}
function deterministicEnv(workspace) {
  const env = { PATH: process.env.PATH || '', CI: '1', TZ: 'UTC', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', NODE_ENV: 'production', SOURCE_DATE_EPOCH: '0', HOME: path.join(workspace, '.home'), npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' };
  if (process.env.SYSTEMROOT) env.SYSTEMROOT = process.env.SYSTEMROOT;
  if (process.env.WINDIR) env.WINDIR = process.env.WINDIR;
  return env;
}
async function runCommand(command, cwd, env, timeoutMs) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const stdout = [], stderr = [];
    child.stdout.on('data', d => stdout.push(d)); child.stderr.on('data', d => stderr.push(d));
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, timeoutMs);
    child.on('error', reject);
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }); });
  });
}
async function scanProviderCoupling(root) {
  const findings = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`output symlink rejected: ${abs}`);
      if (entry.isDirectory()) await visit(abs);
      else if (entry.isFile()) {
        const bytes = await fs.readFile(abs); if (bytes.includes(0)) continue;
        const text = bytes.toString('utf8');
        for (const marker of PROVIDER_MARKERS) if (marker.test(text)) findings.push(path.relative(root, abs).replaceAll(path.sep, '/'));
      } else throw new Error(`unsupported output object: ${abs}`);
    }
  }
  await visit(root);
  if (findings.length) throw new Error(`provider coupling detected: ${[...new Set(findings)].sort().join(', ')}`);
}
async function writeAtomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await fs.writeFile(tmp, `${canonical(value)}\n`, { flag: 'wx', mode: 0o444 });
  const handle = await fs.open(tmp, 'r'); await handle.sync(); await handle.close();
  await fs.rename(tmp, file);
}

export async function reproduce({ source, output, command, dist = 'dist', sourceIdentity = 'unversioned', timeoutMs = 300000 }) {
  if (!Array.isArray(command) || !command.length) throw new Error('command vector required');
  const sourceRoot = path.resolve(source), outputRoot = path.resolve(output);
  await fs.access(sourceRoot);
  try { await fs.access(outputRoot); throw new Error(`output exists: ${outputRoot}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const transactionRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-repro-')), runs = [];
  try {
    for (let index = 1; index <= 2; index++) {
      const workspace = path.join(transactionRoot, `run-${index}`);
      await copySource(sourceRoot, workspace); await fs.mkdir(path.join(workspace, '.home'), { recursive: true });
      const result = await runCommand(command, workspace, deterministicEnv(workspace), timeoutMs);
      if (result.code !== 0) throw new Error(`build ${index} failed: exit=${result.code} signal=${result.signal || 'none'}`);
      const distRoot = path.resolve(workspace, dist);
      if (!distRoot.startsWith(`${workspace}${path.sep}`)) throw new Error('dist path escapes workspace');
      await fs.access(distRoot); await scanProviderCoupling(distRoot);
      const artifact = await inventory(distRoot);
      runs.push({ index, artifactIdentity: artifact.identity, files: artifact.files, stdoutSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr), stdout: result.stdout, stderr: result.stderr });
    }
    if (runs[0].artifactIdentity !== runs[1].artifactIdentity) throw new Error(`nondeterministic output: ${runs[0].artifactIdentity} != ${runs[1].artifactIdentity}`);
    const stage = `${outputRoot}.tmp-${randomUUID()}`;
    await fs.mkdir(stage, { recursive: true });
    await fs.cp(path.join(transactionRoot, 'run-1', dist), path.join(stage, 'artifact'), { recursive: true, errorOnExist: true });
    for (const run of runs) {
      await fs.writeFile(path.join(stage, `build-${run.index}.stdout.log`), run.stdout, { flag: 'wx' });
      await fs.writeFile(path.join(stage, `build-${run.index}.stderr.log`), run.stderr, { flag: 'wx' });
    }
    const authority = { schema: SCHEMA, sourceIdentity, command, dist, artifactIdentity: runs[0].artifactIdentity, runs: runs.map(({ index, artifactIdentity, stdoutSha256, stderrSha256 }) => ({ index, artifactIdentity, stdoutSha256, stderrSha256, exitCode: 0, signal: null })), policy: POLICY };
    const evidence = { ...authority, contentIdentity: sha256(Buffer.from(canonical(authority))) };
    await writeAtomicJson(path.join(stage, 'reproducibility.json'), evidence);
    await fs.rename(stage, outputRoot);
    return evidence;
  } finally { await fs.rm(transactionRoot, { recursive: true, force: true }); }
}

async function cli() {
  const args = process.argv.slice(2), split = args.indexOf('--'), flags = split === -1 ? args : args.slice(0, split), command = split === -1 ? [] : args.slice(split + 1);
  const get = name => { const i = flags.indexOf(name); return i >= 0 ? flags[i + 1] : undefined; };
  const source = get('--source'), output = get('--output');
  if (!source || !output || !command.length) throw new Error('usage: fia-source-reproducibility --source <dir> --output <dir> [--dist dist] [--sourceIdentity id] -- <command...>');
  const result = await reproduce({ source, output, command, dist: get('--dist') || 'dist', sourceIdentity: get('--sourceIdentity') || 'unversioned' });
  process.stdout.write(`${result.contentIdentity}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
