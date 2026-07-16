#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.reproducibility-attestation.v1';
const DEFAULT_EXCLUDES = new Set(['.git', 'node_modules', 'dist', '.fia', '.fia-store']);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

async function listFiles(root, relative = '') {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(child.split(path.sep).join('/'));
    else throw new Error(`Unsupported output entry: ${child}`);
  }
  return files;
}

export async function inventoryDirectory(root) {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) throw new Error(`Build output directory does not exist: ${root}`);
  const files = await listFiles(root);
  const records = [];
  for (const relativePath of files) {
    const bytes = await readFile(path.join(root, relativePath));
    records.push({ path: relativePath, size: bytes.length, sha256: sha256(bytes) });
  }
  const canonical = records.map((record) => `${record.path}\0${record.size}\0${record.sha256}`).join('\n');
  return { files: records, aggregateSha256: sha256(Buffer.from(canonical)) };
}

export function compareInventories(first, second) {
  const differences = [];
  const firstMap = new Map(first.files.map((file) => [file.path, file]));
  const secondMap = new Map(second.files.map((file) => [file.path, file]));
  const paths = [...new Set([...firstMap.keys(), ...secondMap.keys()])].sort();
  for (const filePath of paths) {
    const a = firstMap.get(filePath);
    const b = secondMap.get(filePath);
    if (!a) differences.push({ path: filePath, kind: 'only-in-build-b' });
    else if (!b) differences.push({ path: filePath, kind: 'only-in-build-a' });
    else if (a.sha256 !== b.sha256 || a.size !== b.size) {
      differences.push({ path: filePath, kind: 'content-mismatch', buildA: a, buildB: b });
    }
  }
  return differences;
}

export async function assertImmutableLockfile(sourceRoot, lockfile = 'package-lock.json') {
  const lockPath = path.resolve(sourceRoot, lockfile);
  const lockStat = await stat(lockPath).catch(() => null);
  if (!lockStat?.isFile()) {
    throw new Error(`Immutable dependency lockfile required but missing: ${lockfile}`);
  }
  const bytes = await readFile(lockPath);
  return { path: lockfile, sha256: sha256(bytes), size: bytes.length };
}

async function copySource(sourceRoot, destination) {
  await cp(sourceRoot, destination, {
    recursive: true,
    filter(source) {
      const relative = path.relative(sourceRoot, source);
      if (!relative) return true;
      const first = relative.split(path.sep)[0];
      return !DEFAULT_EXCLUDES.has(first);
    },
  });
}

async function runCommand(command, cwd, env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error(`Build command failed with exit code ${code}\n${stderr || stdout}`));
    });
  });
}

export async function runReproducibilityGate({
  sourceRoot,
  command,
  output = 'dist',
  lockfile = 'package-lock.json',
  attestation,
  keepWorkspaces = false,
}) {
  if (!sourceRoot || !command) throw new Error('sourceRoot and command are required');
  const absoluteSource = path.resolve(sourceRoot);
  const lock = await assertImmutableLockfile(absoluteSource, lockfile);
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'fia-repro-'));
  const workspaces = [path.join(tempRoot, 'build-a'), path.join(tempRoot, 'build-b')];
  const logs = [];

  try {
    for (const [index, workspace] of workspaces.entries()) {
      await mkdir(workspace, { recursive: true });
      await copySource(absoluteSource, workspace);
      const result = await runCommand(command, workspace, {
        ...process.env,
        CI: 'true',
        TZ: 'UTC',
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || '0',
        FIA_REPRO_BUILD_INDEX: String(index + 1),
      });
      logs.push({ build: index === 0 ? 'a' : 'b', stdout: result.stdout, stderr: result.stderr });
    }

    const buildA = await inventoryDirectory(path.join(workspaces[0], output));
    const buildB = await inventoryDirectory(path.join(workspaces[1], output));
    const differences = compareInventories(buildA, buildB);
    const result = {
      schema: SCHEMA,
      reproducible: differences.length === 0,
      command,
      output,
      lockfile: lock,
      environment: { CI: 'true', TZ: 'UTC', LANG: 'C.UTF-8', SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || '0' },
      buildA,
      buildB,
      differences,
      logs,
    };
    const canonical = JSON.stringify(result);
    result.attestationSha256 = sha256(Buffer.from(canonical));

    if (attestation) {
      const destination = path.resolve(attestation);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    }

    if (differences.length > 0) {
      const error = new Error(`Build is not reproducible: ${differences.length} output difference(s)`);
      error.result = result;
      throw error;
    }
    return result;
  } finally {
    if (!keepWorkspaces) await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runReproducibilityGate({
    sourceRoot: args.source || '.',
    command: args.command,
    output: args.output || 'dist',
    lockfile: args.lockfile || 'package-lock.json',
    attestation: args.attestation,
    keepWorkspaces: args['keep-workspaces'] === 'true',
  });
  process.stdout.write(`${JSON.stringify({ reproducible: true, artifact: result.buildA.aggregateSha256, attestation: result.attestationSha256 })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    if (error.result) process.stderr.write(`${JSON.stringify(error.result.differences, null, 2)}\n`);
    process.exitCode = 1;
  });
}
