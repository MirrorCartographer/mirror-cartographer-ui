#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const POLICY_SCHEMA = 'fia.seccomp-policy.v1';
const OUTPUT_SCHEMA = 'fia.seccomp-enforcement-verification.v1';
const REQUIRED_PROBES = Object.freeze(['baseline', 'ptrace', 'namespace', 'mount', 'rawSocket']);

function fail(message) { throw new Error(message); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}
function canonicalBytes(value) { return Buffer.from(JSON.stringify(canonical(value))); }
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}
function parseCommand(value) {
  let command;
  try { command = JSON.parse(value); } catch { fail('--probeCommand must be a JSON array'); }
  if (!Array.isArray(command) || command.length === 0 || command.some(item => typeof item !== 'string' || item.length === 0)) {
    fail('--probeCommand must be a non-empty array of strings');
  }
  return command;
}
function validateSha256(value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(`${field} must be lowercase SHA-256`);
}
function recomputePolicyIdentity(policy) {
  const material = { ...policy };
  delete material.identity;
  return sha256(canonicalBytes(material));
}
function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('compiled policy must be an object');
  if (policy.schema !== POLICY_SCHEMA) fail(`unsupported policy schema: ${String(policy.schema)}`);
  validateSha256(policy.identity, 'policy.identity');
  validateSha256(policy.policySha256, 'policy.policySha256');
  if (recomputePolicyIdentity(policy) !== policy.identity) fail('compiled policy identity mismatch');
  if (sha256(canonicalBytes(policy.oci)) !== policy.policySha256) fail('compiled OCI policy digest mismatch');
  const invariants = policy.invariants ?? {};
  for (const field of ['namespaceCreationDenied','mountMutationDenied','processInspectionDenied','rawPacketSocketsDenied']) {
    if (invariants[field] !== true) fail(`required policy invariant is not enforced: ${field}`);
  }
  return policy;
}
async function executableIdentity(executable) {
  const resolved = path.resolve(executable);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isFile()) fail(`probe executable is not a regular file: ${resolved}`);
  const bytes = await readFile(resolved);
  return { name: path.basename(resolved), bytes: bytes.length, sha256: sha256(bytes) };
}
function runProbe(command, policyPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC',
        FIA_SECCOMP_POLICY: path.resolve(policyPath)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const limit = 1024 * 1024;
    const append = (chunks, chunk, current) => {
      const remaining = Math.max(0, limit - current);
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
      return current + chunk.length;
    };
    child.stdout.on('data', chunk => { stdoutBytes = append(stdout, chunk, stdoutBytes); });
    child.stderr.on('data', chunk => { stderrBytes = append(stderr, chunk, stderrBytes); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code, signal, timedOut,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        stdoutTruncated: stdoutBytes > limit,
        stderrTruncated: stderrBytes > limit
      });
    });
  });
}
function validateProbeResult(result, policy) {
  if (result.timedOut) fail('seccomp probe timed out');
  if (result.code !== 0) fail(`seccomp probe failed with exit ${result.code}${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  let report;
  try { report = JSON.parse(result.stdout); } catch { fail('seccomp probe stdout is not valid JSON'); }
  if (!report || typeof report !== 'object' || Array.isArray(report)) fail('seccomp probe report must be an object');
  if (report.schema !== 'fia.seccomp-probe-result.v1') fail(`unsupported probe schema: ${String(report.schema)}`);
  if (report.policyIdentity !== policy.identity) fail('probe loaded a different policy identity');
  if (report.filterLoaded !== true) fail('probe did not prove that the seccomp filter was loaded');
  const probes = report.probes;
  if (!probes || typeof probes !== 'object' || Array.isArray(probes)) fail('probe report is missing probes');
  const baseline = probes.baseline;
  if (!baseline || baseline.allowed !== true || baseline.executed !== true) fail('baseline syscall probe did not execute successfully');
  for (const name of REQUIRED_PROBES.slice(1)) {
    const probe = probes[name];
    if (!probe || probe.executed !== true) fail(`${name} denial probe was not executed`);
    if (probe.denied !== true) fail(`${name} denial probe was not denied`);
    if (!Number.isInteger(probe.errno) || probe.errno <= 0) fail(`${name} denial probe did not report a positive errno`);
  }
  const unexpected = Object.keys(probes).filter(name => !REQUIRED_PROBES.includes(name)).sort();
  return canonical({ schema: report.schema, policyIdentity: report.policyIdentity, filterLoaded: true, probes, unexpectedProbeNames: unexpected });
}

export async function verifySeccompEnforcement({ policyPath, probeCommand, timeoutMs = 15000 }) {
  const policyBytes = await readFile(policyPath);
  let parsed;
  try { parsed = JSON.parse(policyBytes); } catch { fail('compiled policy is not valid JSON'); }
  const policy = validatePolicy(parsed);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) fail('timeoutMs must be between 100 and 120000');
  const commandIdentity = await executableIdentity(probeCommand[0]);
  const result = await runProbe(probeCommand, policyPath, timeoutMs);
  const probe = validateProbeResult(result, policy);
  const evidence = {
    schema: OUTPUT_SCHEMA,
    policy: { identity: policy.identity, policySha256: policy.policySha256, fileSha256: sha256(policyBytes), bytes: policyBytes.length },
    probeCommand: { executable: commandIdentity, arguments: probeCommand.slice(1) },
    probe,
    logs: {
      stdoutSha256: sha256(Buffer.from(result.stdout)),
      stderrSha256: sha256(Buffer.from(result.stderr)),
      stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated
    },
    status: 'verified'
  };
  evidence.identity = sha256(canonicalBytes(evidence));
  return canonical(evidence);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.policy || !args.probeCommand || !args.output) {
    fail('usage: --policy <compiled.json> --probeCommand <json-array> --output <verification.json> [--timeoutMs <ms>]');
  }
  const verification = await verifySeccompEnforcement({
    policyPath: args.policy,
    probeCommand: parseCommand(args.probeCommand),
    timeoutMs: args.timeoutMs === undefined ? 15000 : Number(args.timeoutMs)
  });
  await writeFile(path.resolve(args.output), `${JSON.stringify(verification, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${verification.identity}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
