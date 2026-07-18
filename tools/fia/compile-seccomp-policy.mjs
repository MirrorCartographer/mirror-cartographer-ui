#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.seccomp-policy.v1';
const DEFAULT_DENY = Object.freeze([
  'bpf','clone3','delete_module','finit_module','init_module','kexec_file_load','kexec_load',
  'keyctl','mount','move_mount','open_by_handle_at','perf_event_open','pivot_root','ptrace',
  'reboot','setns','swapon','swapoff','umount2','unshare','userfaultfd'
]);
const RAW_SOCKET_SYSCALLS = Object.freeze(['socket']);
const VALID_ARCHES = new Set(['SCMP_ARCH_X86_64','SCMP_ARCH_AARCH64']);
const VALID_ACTIONS = new Set(['SCMP_ACT_ALLOW','SCMP_ACT_ERRNO','SCMP_ACT_KILL_PROCESS','SCMP_ACT_LOG']);

function fail(message) { throw new Error(message); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}
function canonicalBytes(value) { return Buffer.from(JSON.stringify(canonical(value))); }
function uniqueSortedStrings(values, field) {
  if (!Array.isArray(values)) fail(`${field} must be an array`);
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string' || !/^[a-z0-9_]+$/.test(value)) fail(`${field} contains invalid syscall: ${String(value)}`);
    out.push(value);
  }
  return [...new Set(out)].sort();
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}
function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('policy input must be an object');
  const architectures = input.architectures ?? ['SCMP_ARCH_X86_64'];
  if (!Array.isArray(architectures) || architectures.length === 0) fail('architectures must be a non-empty array');
  const normalizedArch = [...new Set(architectures)].sort();
  for (const arch of normalizedArch) if (!VALID_ARCHES.has(arch)) fail(`unsupported architecture: ${arch}`);

  const defaultAction = input.defaultAction ?? 'SCMP_ACT_ALLOW';
  const denyAction = input.denyAction ?? 'SCMP_ACT_ERRNO';
  if (!VALID_ACTIONS.has(defaultAction)) fail(`invalid defaultAction: ${defaultAction}`);
  if (!VALID_ACTIONS.has(denyAction) || denyAction === 'SCMP_ACT_ALLOW') fail(`invalid denyAction: ${denyAction}`);

  const deny = uniqueSortedStrings(input.denySyscalls ?? DEFAULT_DENY, 'denySyscalls');
  const allow = uniqueSortedStrings(input.allowSyscalls ?? [], 'allowSyscalls');
  const overlap = deny.filter(name => allow.includes(name));
  if (overlap.length) fail(`syscalls cannot be both allowed and denied: ${overlap.join(', ')}`);

  const rawSockets = input.denyRawSockets !== false;
  if (rawSockets && allow.includes('socket')) fail('socket cannot be broadly allowed when denyRawSockets is enabled');

  return {
    architectures: normalizedArch,
    defaultAction,
    denyAction,
    denySyscalls: deny,
    allowSyscalls: allow,
    denyRawSockets: rawSockets,
    errno: Number.isInteger(input.errno) ? input.errno : 1,
  };
}
function compile(normalized) {
  const syscalls = [];
  if (normalized.denySyscalls.length) {
    syscalls.push({ names: normalized.denySyscalls, action: normalized.denyAction, errnoRet: normalized.errno });
  }
  if (normalized.allowSyscalls.length) {
    syscalls.push({ names: normalized.allowSyscalls, action: 'SCMP_ACT_ALLOW' });
  }
  if (normalized.denyRawSockets) {
    syscalls.push({
      names: RAW_SOCKET_SYSCALLS,
      action: normalized.denyAction,
      errnoRet: normalized.errno,
      args: [{ index: 0, value: 17, valueTwo: 0, op: 'SCMP_CMP_EQ' }]
    });
  }
  const oci = canonical({ defaultAction: normalized.defaultAction, architectures: normalized.architectures, syscalls });
  const policy = {
    schema: SCHEMA,
    policy: normalized,
    oci,
    policySha256: sha256(canonicalBytes(oci)),
    invariants: {
      namespaceCreationDenied: ['clone3','setns','unshare'].every(x => normalized.denySyscalls.includes(x)),
      mountMutationDenied: ['mount','move_mount','pivot_root','umount2'].every(x => normalized.denySyscalls.includes(x)),
      kernelMutationDenied: ['bpf','delete_module','finit_module','init_module','kexec_file_load','kexec_load','reboot'].every(x => normalized.denySyscalls.includes(x)),
      processInspectionDenied: normalized.denySyscalls.includes('ptrace'),
      rawPacketSocketsDenied: normalized.denyRawSockets,
    }
  };
  const identityMaterial = { ...policy };
  policy.identity = sha256(canonicalBytes(identityMaterial));
  return canonical(policy);
}
export function compileSeccompPolicy(input) { return compile(normalizeInput(input)); }

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input || !args.output) fail('usage: --input <policy.json> --output <compiled.json>');
  const inputBytes = await readFile(args.input);
  let input;
  try { input = JSON.parse(inputBytes); } catch { fail('input is not valid JSON'); }
  const compiled = compileSeccompPolicy(input);
  const out = `${JSON.stringify(compiled, null, 2)}\n`;
  await writeFile(path.resolve(args.output), out, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${compiled.identity}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
