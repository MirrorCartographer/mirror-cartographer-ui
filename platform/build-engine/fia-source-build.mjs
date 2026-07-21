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
  providerNeutral: true,
  inheritEnvironment: ['PATH', 'SYSTEMROOT', 'WINDIR'],
  deterministicEnvironment: {
    CI: '1',
    TZ: 'UTC',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NODE_ENV: 'production',
    SOURCE_DATE_EPOCH: '0',
  },
  rejectSymlinks: true,
  rejectProviderCoupling: true,
  requireZeroExit: true,
  requireDeclaredOutput: true,
  compareReleaseIdentity: true,
  retainLogs: true,
  atomicPublication: true,
});

const PROVIDER_PATTERNS = [
  /\bvercel\b/i,
  /vercel\.(?:app|com)/i,
  /\bVERCEL_[A-Z0-9_]+\b/,
  /\bcloudflare\b/i,
  /pages\.dev/i,
  /\bCF_PAGES[A-Z0-9_]*\b/,
  /\bgithub pages\b/i,
  /github\.io/i,
  /\bGITHUB_PAGES\b/,
];

function sha256(data) {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function safeRelative(relativePath) {
  const normalized = relativePath.normalize('NFC').replaceAll(path.sep, '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))
  ) {
    throw new Error(`unsafe path: ${relativePath}`);
  }
  return normalized;
}

async function fsyncFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function fsyncDirectory(directory) {
  const handle = await fs.open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function assertAbsent(target) {
  try {
    await fs.access(target);
    throw new Error(`output exists: ${target}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function copySource(sourceRoot, destinationRoot) {
  const folded = new Set();
  async function visit(sourceDirectory, destinationDirectory) {
    await fs.mkdir(destinationDirectory, { recursive: true });
    const entries = (await fs.readdir(sourceDirectory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.fia' || entry.name === 'node_modules') continue;
      const sourcePath = path.join(sourceDirectory, entry.name);
      const relative = safeRelative(path.relative(sourceRoot, sourcePath));
      const foldedPath = relative.toLocaleLowerCase('en-US');
      if (folded.has(foldedPath)) throw new Error(`case-fold collision: ${relative}`);
      folded.add(foldedPath);
      const destinationPath = path.join(destinationRoot, relative);
      if (entry.isSymbolicLink()) throw new Error(`source symlink rejected: ${relative}`);
      if (entry.isDirectory()) {
        await visit(sourcePath, destinationPath);
        continue;
      }
      if (!entry.isFile()) throw new Error(`unsupported source object: ${relative}`);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(sourcePath, destinationPath);
      await fs.chmod(destinationPath, 0o644);
    }
  }
  await visit(sourceRoot, destinationRoot);
}

function childEnvironment(home) {
  const environment = {};
  for (const key of POLICY.inheritEnvironment) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  Object.assign(environment, POLICY.deterministicEnvironment, {
    HOME: home,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  });
  return environment;
}

async function runCommand({ command, cwd, home, timeoutMs }) {
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !part)) {
    throw new Error('command must be a non-empty string array');
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: childEnvironment(home),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        timedOut,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
  });
}

async function scanProviderCoupling(root) {
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = safeRelative(path.relative(root, absolute));
      if (entry.isSymbolicLink()) throw new Error(`output symlink rejected: ${relative}`);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) throw new Error(`unsupported output object: ${relative}`);
      const bytes = await fs.readFile(absolute);
      if (bytes.includes(0)) continue;
      const text = bytes.toString('utf8');
      const match = PROVIDER_PATTERNS.find((pattern) => pattern.test(text));
      if (match) throw new Error(`provider coupling detected in ${relative}`);
    }
  }
  await visit(root);
}

async function executeBuild({ sourceRoot, command, dist, sourceIdentity, timeoutMs, runIndex, workspaceRoot }) {
  const workspace = path.join(workspaceRoot, `workspace-${runIndex}`);
  const sourceCopy = path.join(workspace, 'source');
  const home = path.join(workspace, 'home');
  const release = path.join(workspace, 'release');
  await fs.mkdir(home, { recursive: true });
  await copySource(sourceRoot, sourceCopy);
  const result = await runCommand({ command, cwd: sourceCopy, home, timeoutMs });
  if (result.timedOut) throw new Error(`build ${runIndex} timed out`);
  if (result.code !== 0) throw new Error(`build ${runIndex} failed with exit ${result.code ?? 'null'} signal ${result.signal ?? 'none'}`);
  const distRoot = path.resolve(sourceCopy, dist);
  const stat = await fs.stat(distRoot).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`build ${runIndex} did not produce declared output: ${dist}`);
  await scanProviderCoupling(distRoot);
  const manifest = await packageRelease({
    input: distRoot,
    output: release,
    sourceIdentity,
  });
  return { result, release, manifest };
}

export async function compileSource({
  source,
  output,
  command,
  dist = 'dist',
  sourceIdentity = 'unversioned',
  timeoutMs = 120_000,
}) {
  const sourceRoot = path.resolve(source);
  const outputRoot = path.resolve(output);
  if (!(await fs.stat(sourceRoot)).isDirectory()) throw new Error(`source is not a directory: ${sourceRoot}`);
  await assertAbsent(outputRoot);
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-source-build-'));
  const stagingRoot = `${outputRoot}.staging-${process.pid}`;
  await fs.rm(stagingRoot, { recursive: true, force: true });

  try {
    const first = await executeBuild({ sourceRoot, command, dist, sourceIdentity, timeoutMs, runIndex: 1, workspaceRoot });
    const second = await executeBuild({ sourceRoot, command, dist, sourceIdentity, timeoutMs, runIndex: 2, workspaceRoot });
    if (first.manifest.releaseIdentity !== second.manifest.releaseIdentity) {
      throw new Error(`reproducibility mismatch: ${first.manifest.releaseIdentity} != ${second.manifest.releaseIdentity}`);
    }

    await fs.mkdir(stagingRoot, { recursive: true });
    await fs.cp(first.release, path.join(stagingRoot, 'release'), { recursive: true, errorOnExist: true });
    const logs = [
      ['build-1.stdout.log', first.result.stdout],
      ['build-1.stderr.log', first.result.stderr],
      ['build-2.stdout.log', second.result.stdout],
      ['build-2.stderr.log', second.result.stderr],
    ];
    for (const [name, bytes] of logs) {
      const target = path.join(stagingRoot, name);
      await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o444 });
      await fsyncFile(target);
    }

    const authority = {
      schema: SCHEMA,
      sourceIdentity,
      command,
      dist,
      releaseIdentity: first.manifest.releaseIdentity,
      runs: [
        {
          stdoutSha256: sha256(first.result.stdout),
          stderrSha256: sha256(first.result.stderr),
          exitCode: first.result.code,
          signal: first.result.signal,
        },
        {
          stdoutSha256: sha256(second.result.stdout),
          stderrSha256: sha256(second.result.stderr),
          exitCode: second.result.code,
          signal: second.result.signal,
        },
      ],
      policy: POLICY,
    };
    const contentIdentity = sha256(Buffer.from(canonical(authority)));
    const evidence = { ...authority, contentIdentity };
    const evidencePath = path.join(stagingRoot, 'reproducibility.json');
    await fs.writeFile(evidencePath, `${canonical(evidence)}\n`, { flag: 'wx', mode: 0o444 });
    await fsyncFile(evidencePath);
    await fsyncDirectory(stagingRoot);
    await fs.rename(stagingRoot, outputRoot);
    await fsyncDirectory(path.dirname(outputRoot));
    return evidence;
  } catch (error) {
    await fs.rm(stagingRoot, { recursive: true, force: true });
    throw error;
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function cli() {
  const args = process.argv.slice(2);
  const separator = args.indexOf('--');
  const options = separator >= 0 ? args.slice(0, separator) : args;
  const command = separator >= 0 ? args.slice(separator + 1) : [];
  const value = (name) => {
    const index = options.indexOf(name);
    return index >= 0 ? options[index + 1] : undefined;
  };
  const source = value('--source');
  const output = value('--output');
  if (!source || !output || !command.length) {
    throw new Error('usage: fia-source-build --source <dir> --output <dir> [--dist <dir>] [--sourceIdentity <id>] [--timeoutMs <ms>] -- <command...>');
  }
  const result = await compileSource({
    source,
    output,
    command,
    dist: value('--dist') ?? 'dist',
    sourceIdentity: value('--sourceIdentity') ?? 'unversioned',
    timeoutMs: Number(value('--timeoutMs') ?? 120_000),
  });
  process.stdout.write(`${result.contentIdentity}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
