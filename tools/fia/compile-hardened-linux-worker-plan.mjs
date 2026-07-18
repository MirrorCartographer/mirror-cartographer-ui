#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.hardened-linux-worker-plan.v1';
const DEFAULTS = Object.freeze({
  cpuSeconds: 900,
  addressSpaceBytes: 2_147_483_648,
  fileSizeBytes: 536_870_912,
  openFiles: 1024,
  processes: 256,
  timeoutMs: 900_000,
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
const stable = (value) => JSON.stringify(canonical(value));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fail(message) { throw new Error(message); }
function integer(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) fail(`${name} must be an integer from ${min} through ${max}`);
  return parsed;
}
function parseJson(value, name) {
  try { return JSON.parse(value); } catch { fail(`${name} must be valid JSON`); }
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[key.slice(2)] = value;
  }
  for (const key of ['command', 'workspace', 'output']) if (!out[key]) fail(`missing --${key}`);
  const command = parseJson(out.command, '--command');
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !part)) {
    fail('--command must be a non-empty JSON string array');
  }
  return {
    command,
    workspace: out.workspace,
    output: out.output,
    cpuSeconds: out.cpuSeconds ?? DEFAULTS.cpuSeconds,
    addressSpaceBytes: out.addressSpaceBytes ?? DEFAULTS.addressSpaceBytes,
    fileSizeBytes: out.fileSizeBytes ?? DEFAULTS.fileSizeBytes,
    openFiles: out.openFiles ?? DEFAULTS.openFiles,
    processes: out.processes ?? DEFAULTS.processes,
    timeoutMs: out.timeoutMs ?? DEFAULTS.timeoutMs,
  };
}
async function ensureAbsent(target) {
  try { await stat(target); fail(`destination already exists: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function probe(binary, args) {
  const result = spawnSync(binary, args, { stdio: 'ignore' });
  return { available: !result.error && result.status === 0, status: result.status, error: result.error?.code ?? null };
}
async function executableIdentity(binary) {
  const lookup = spawnSync('sh', ['-c', 'command -v "$1"', 'fia-lookup', binary], { encoding: 'utf8' });
  if (lookup.status !== 0) fail(`required executable is unavailable: ${binary}`);
  const resolved = lookup.stdout.trim();
  await access(resolved);
  const bytes = await readFile(resolved);
  return { name: binary, sha256: sha256(bytes), bytes: bytes.length };
}

export async function compileHardenedLinuxWorkerPlan(options, hooks = {}) {
  if (process.platform !== 'linux' && !hooks.allowNonLinux) fail('hardened Linux worker requires Linux');
  const workspace = path.resolve(options.workspace);
  const output = path.resolve(options.output);
  await ensureAbsent(output);
  const workspaceInfo = await stat(workspace).catch(() => null);
  if (!workspaceInfo?.isDirectory()) fail('workspace must be an existing directory');

  const limits = {
    cpuSeconds: integer(options.cpuSeconds ?? DEFAULTS.cpuSeconds, 'cpuSeconds', 1, 86_400),
    addressSpaceBytes: integer(options.addressSpaceBytes ?? DEFAULTS.addressSpaceBytes, 'addressSpaceBytes', 67_108_864, 1_099_511_627_776),
    fileSizeBytes: integer(options.fileSizeBytes ?? DEFAULTS.fileSizeBytes, 'fileSizeBytes', 1_048_576, 1_099_511_627_776),
    openFiles: integer(options.openFiles ?? DEFAULTS.openFiles, 'openFiles', 32, 1_048_576),
    processes: integer(options.processes ?? DEFAULTS.processes, 'processes', 1, 65_536),
    timeoutMs: integer(options.timeoutMs ?? DEFAULTS.timeoutMs, 'timeoutMs', 100, 86_400_000),
  };
  const command = options.command;
  if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !part)) fail('command must be a non-empty string array');

  const probeFn = hooks.probe ?? probe;
  const namespaceProbe = probeFn('unshare', ['--user', '--map-root-user', '--mount', '--net', '--pid', '--fork', '--mount-proc', 'true']);
  const prlimitProbe = probeFn('prlimit', ['--cpu=1:1', '--nofile=32:32', '--', 'true']);
  if (!namespaceProbe.available) fail('required user, mount, network, and PID namespaces are unavailable');
  if (!prlimitProbe.available) fail('required prlimit resource enforcement is unavailable');

  const identityFn = hooks.executableIdentity ?? executableIdentity;
  const executables = {
    unshare: await identityFn('unshare'),
    prlimit: await identityFn('prlimit'),
    command: await identityFn(command[0]),
  };
  const launcher = [
    'unshare', '--user', '--map-root-user', '--mount', '--net', '--pid', '--fork', '--mount-proc', '--',
    'prlimit',
    `--cpu=${limits.cpuSeconds}:${limits.cpuSeconds}`,
    `--as=${limits.addressSpaceBytes}:${limits.addressSpaceBytes}`,
    `--fsize=${limits.fileSizeBytes}:${limits.fileSizeBytes}`,
    `--nofile=${limits.openFiles}:${limits.openFiles}`,
    `--nproc=${limits.processes}:${limits.processes}`,
    '--', ...command,
  ];
  const record = {
    schema: SCHEMA,
    policy: {
      namespaces: ['user', 'mount', 'network', 'pid'],
      mountProc: true,
      mapRootUser: true,
      resourceEnforcement: 'rlimit-hard-and-soft-equal',
      timeoutEnforcement: 'outer-worker-process-group',
      filesystemRoot: 'not-chrooted',
      seccomp: 'not-configured',
      cgroupV2: 'not-configured',
    },
    workspace: { representation: 'caller-provided-disposable-directory' },
    limits,
    command: { executable: path.basename(command[0]), args: command.slice(1) },
    executables,
    probes: { namespaces: namespaceProbe, prlimit: prlimitProbe },
    launcher,
  };
  record.identity = sha256(Buffer.from(stable(record)));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  compileHardenedLinuxWorkerPlan(parseArgs(process.argv))
    .then((record) => process.stdout.write(`${record.identity}\n`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
