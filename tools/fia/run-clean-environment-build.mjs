#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const SCHEMA = 'fia.clean-environment-build-attestation.v1';
const DEP_SCHEMA = 'fia.offline-dependency-reproducibility.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const stable = (value) => JSON.stringify(canonical(value));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fail(message) { throw new Error(message); }
function parseJson(bytes, label) { try { return JSON.parse(bytes.toString('utf8')); } catch { fail(`${label} is not valid JSON`); } }
function splitCommand(value, label) {
  const parsed = parseJson(Buffer.from(value), label);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((item) => typeof item !== 'string' || item.length === 0)) fail(`${label} must be a non-empty JSON string array`);
  return parsed;
}
function parseArgs(argv) {
  const out = { attempts: '2' };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[key.slice(2)] = value;
  }
  for (const key of ['source', 'lockfile', 'dependencyEvidence', 'installCommand', 'buildCommand', 'outputDir', 'attestation']) if (!out[key]) fail(`missing --${key}`);
  const attempts = Number(out.attempts);
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 8) fail('--attempts must be an integer from 2 through 8');
  return { ...out, attempts, installCommand: splitCommand(out.installCommand, '--installCommand'), buildCommand: splitCommand(out.buildCommand, '--buildCommand') };
}
async function ensureAbsent(target) {
  try { await stat(target); fail(`destination already exists: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk)); child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = { code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) };
      if (code !== 0) reject(Object.assign(new Error(`${command} failed with exit code ${code}`), { result })); else resolve(result);
    });
  });
}
async function inventory(root, label) {
  const entries = [];
  async function walk(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name); const relative = path.posix.join(prefix, name); const info = await lstat(absolute);
      if (info.isSymbolicLink()) fail(`symlink is not allowed in ${label}: ${relative}`);
      if (info.isDirectory()) { entries.push({ path: `${relative}/`, type: 'directory', mode: info.mode & 0o777 }); await walk(absolute, relative); }
      else if (info.isFile()) { const bytes = await readFile(absolute); entries.push({ path: relative, type: 'file', mode: info.mode & 0o777, bytes: bytes.length, sha256: sha256(bytes) }); }
      else fail(`unsupported filesystem entry in ${label}: ${relative}`);
    }
  }
  await walk(root); return entries;
}
async function commandEvidence(command) {
  const executable = path.resolve(command[0]);
  let executableIdentity = null;
  try { const bytes = await readFile(executable); executableIdentity = { bytes: bytes.length, sha256: sha256(bytes) }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { executable: path.basename(command[0]), executableIdentity, args: command.slice(1) };
}
async function copySource(source, destination, exclusions) {
  await cp(source, destination, {
    recursive: true,
    dereference: false,
    filter: (entry) => {
      const relative = path.relative(source, entry).replaceAll('\\', '/');
      if (!relative) return true;
      const first = relative.split('/')[0];
      return !exclusions.has(first);
    },
  });
}
function validateDependencyEvidence(record, bytes, lockBytes) {
  if (record.schema !== DEP_SCHEMA) fail(`dependency evidence schema must be ${DEP_SCHEMA}`);
  if (typeof record.identity !== 'string' || !/^[a-f0-9]{64}$/.test(record.identity)) fail('dependency evidence identity is invalid');
  const withoutIdentity = { ...record }; delete withoutIdentity.identity;
  if (sha256(Buffer.from(stable(withoutIdentity))) !== record.identity) fail('dependency evidence identity mismatch');
  if (record.lockfile?.sha256 !== sha256(lockBytes) || record.lockfile?.bytes !== lockBytes.length) fail('dependency evidence does not bind the supplied lockfile');
  if (typeof record.dependencyInventoryIdentity !== 'string' || !Array.isArray(record.dependencyInventory)) fail('dependency evidence inventory is incomplete');
  if (sha256(Buffer.from(stable(record.dependencyInventory))) !== record.dependencyInventoryIdentity) fail('dependency inventory identity mismatch');
  return { identity: record.identity, bytesSha256: sha256(bytes), inventoryIdentity: record.dependencyInventoryIdentity };
}

export async function runCleanEnvironmentBuild(options) {
  const source = path.resolve(options.source); const lockfile = path.resolve(options.lockfile); const dependencyEvidence = path.resolve(options.dependencyEvidence);
  const attestation = path.resolve(options.attestation); const outputDir = String(options.outputDir).replaceAll('\\', '/');
  if (path.isAbsolute(outputDir) || path.posix.normalize(outputDir).startsWith('../') || outputDir === '..' || outputDir.includes('/../')) fail('--outputDir must stay inside the workspace');
  const attempts = Number(options.attempts ?? 2);
  if (!Number.isInteger(attempts) || attempts < 2 || attempts > 8) fail('attempts must be an integer from 2 through 8');
  const installCommand = options.installCommand; const buildCommand = options.buildCommand;
  if (!Array.isArray(installCommand) || !installCommand.length || !Array.isArray(buildCommand) || !buildCommand.length) fail('installCommand and buildCommand must be non-empty arrays');
  await ensureAbsent(attestation);
  const [lockBytes, depBytes] = await Promise.all([readFile(lockfile), readFile(dependencyEvidence)]);
  const depRecord = parseJson(depBytes, 'dependency evidence'); const depIdentity = validateDependencyEvidence(depRecord, depBytes, lockBytes);
  const root = await mkdtemp(path.join(tmpdir(), 'fia-clean-build-')); const results = [];
  try {
    for (let index = 0; index < attempts; index += 1) {
      const workspace = path.join(root, `workspace-${index + 1}`);
      await copySource(source, workspace, new Set(['node_modules', outputDir.split('/')[0], '.git']));
      await writeFile(path.join(workspace, path.basename(lockfile)), lockBytes, { flag: 'w' });
      const env = { ...process.env, FIA_NETWORK_POLICY: 'disabled', NO_PROXY: '*', no_proxy: '*', HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9' };
      const install = await run(installCommand[0], installCommand.slice(1), { cwd: workspace, env });
      const dependencyBefore = await inventory(path.join(workspace, 'node_modules'), 'installed dependencies');
      const dependencyBeforeIdentity = sha256(Buffer.from(stable(dependencyBefore)));
      if (dependencyBeforeIdentity !== depIdentity.inventoryIdentity) fail(`installed dependency inventory does not match admitted evidence at attempt ${index + 1}`);
      const artifactPath = path.join(workspace, outputDir);
      try { await stat(artifactPath); fail(`build output already exists before compilation at attempt ${index + 1}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const build = await run(buildCommand[0], buildCommand.slice(1), { cwd: workspace, env });
      const dependencyAfter = await inventory(path.join(workspace, 'node_modules'), 'installed dependencies');
      const dependencyAfterIdentity = sha256(Buffer.from(stable(dependencyAfter)));
      if (dependencyAfterIdentity !== dependencyBeforeIdentity) fail(`build mutated dependency tree at attempt ${index + 1}`);
      const artifact = await inventory(artifactPath, 'build artifact');
      if (artifact.length === 0) fail(`build artifact is empty at attempt ${index + 1}`);
      const artifactIdentity = sha256(Buffer.from(stable(artifact)));
      results.push({
        attempt: index + 1,
        dependencyInventoryIdentity: dependencyBeforeIdentity,
        artifactIdentity,
        artifact,
        install: { stdout: { bytes: install.stdout.length, sha256: sha256(install.stdout) }, stderr: { bytes: install.stderr.length, sha256: sha256(install.stderr) } },
        build: { stdout: { bytes: build.stdout.length, sha256: sha256(build.stdout) }, stderr: { bytes: build.stderr.length, sha256: sha256(build.stderr) } },
      });
    }
    const expectedArtifact = results[0].artifactIdentity;
    for (const result of results.slice(1)) if (result.artifactIdentity !== expectedArtifact) fail(`build artifact diverged at attempt ${result.attempt}`);
    const record = {
      schema: SCHEMA,
      policy: { attempts, network: 'closed-loopback-proxy', staleOutput: 'reject', symlinks: 'reject', dependencyMutation: 'reject', comparison: ['path', 'type', 'mode', 'bytes', 'sha256'] },
      lockfile: { sha256: sha256(lockBytes), bytes: lockBytes.length },
      dependencyEvidence: { identity: depIdentity.identity, bytesSha256: depIdentity.bytesSha256, bytes: depBytes.length },
      commands: { install: await commandEvidence(installCommand), build: await commandEvidence(buildCommand) },
      outputDir,
      dependencyInventoryIdentity: depIdentity.inventoryIdentity,
      artifactIdentity: expectedArtifact,
      artifact: results[0].artifact,
      attempts: results.map(({ attempt, dependencyInventoryIdentity, artifactIdentity, install, build }) => ({ attempt, dependencyInventoryIdentity, artifactIdentity, install, build })),
    };
    record.identity = sha256(Buffer.from(stable(record)));
    await mkdir(path.dirname(attestation), { recursive: true }); await writeFile(attestation, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    return record;
  } finally { await rm(root, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanEnvironmentBuild(parseArgs(process.argv))
    .then((record) => process.stdout.write(`${record.identity}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
