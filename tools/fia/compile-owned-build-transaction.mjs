#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.owned-build-transaction.v1';
const REQUEST_SCHEMA = 'fia.owned-build-transaction-request.v1';

function fail(message) { throw new Error(message); }
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function identityOf(record) {
  const copy = structuredClone(record);
  delete copy.identity;
  return sha256(canonical(copy));
}
function pointerGet(value, pointer) {
  if (pointer === '') return value;
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) fail(`invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split('/').reduce((node, token) => {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !(key in node)) fail(`missing JSON pointer ${pointer}`);
    return node[key];
  }, value);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || value === undefined) fail('arguments must be --name value pairs');
    out[flag.slice(2)] = value;
  }
  if (!out.request || !out.output) fail('usage: --request <json> --output <json>');
  return out;
}
function validateRequest(request) {
  if (request?.schema !== REQUEST_SCHEMA) fail(`request schema must be ${REQUEST_SCHEMA}`);
  if (!Array.isArray(request.artifacts) || request.artifacts.length < 2) fail('request requires at least two artifacts');
  if (!Array.isArray(request.bindings) || request.bindings.length < 1) fail('request requires at least one binding');
  const roles = new Set();
  for (const item of request.artifacts) {
    if (!item || typeof item.role !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.role)) fail('artifact role is invalid');
    if (roles.has(item.role)) fail(`duplicate artifact role: ${item.role}`);
    roles.add(item.role);
    if (typeof item.path !== 'string' || item.path.length === 0) fail(`artifact ${item.role} path is invalid`);
    if (path.isAbsolute(item.path)) fail(`artifact ${item.role} path must be relative to the request`);
    if (typeof item.expectedSchema !== 'string' || item.expectedSchema.length === 0) fail(`artifact ${item.role} expectedSchema is required`);
    if (item.expectedIdentity !== undefined && !/^[0-9a-f]{64}$/.test(item.expectedIdentity)) fail(`artifact ${item.role} expectedIdentity is invalid`);
  }
  for (const binding of request.bindings) {
    if (!roles.has(binding?.fromRole) || !roles.has(binding?.toRole)) fail('binding references an unknown role');
    if (binding.fromRole === binding.toRole && binding.fromPointer === binding.toPointer) fail('self-binding is not evidence');
    if (typeof binding.fromPointer !== 'string' || typeof binding.toPointer !== 'string') fail('binding pointers are required');
  }
}

export async function compileTransaction(requestPath, outputPath) {
  const requestBytes = await readFile(requestPath);
  const request = JSON.parse(requestBytes);
  validateRequest(request);
  const base = path.dirname(path.resolve(requestPath));
  const loaded = new Map();
  const artifacts = [];

  for (const item of [...request.artifacts].sort((a, b) => a.role.localeCompare(b.role))) {
    const resolved = path.resolve(base, item.path);
    if (!(resolved === base || resolved.startsWith(`${base}${path.sep}`))) fail(`artifact ${item.role} escapes request directory`);
    const bytes = await readFile(resolved);
    const record = JSON.parse(bytes);
    if (record.schema !== item.expectedSchema) fail(`artifact ${item.role} schema mismatch`);
    if (!/^[0-9a-f]{64}$/.test(record.identity ?? '')) fail(`artifact ${item.role} lacks a canonical identity`);
    const computed = identityOf(record);
    if (record.identity !== computed) fail(`artifact ${item.role} identity mismatch`);
    if (item.expectedIdentity && item.expectedIdentity !== computed) fail(`artifact ${item.role} does not match expectedIdentity`);
    loaded.set(item.role, record);
    artifacts.push({
      role: item.role,
      schema: record.schema,
      identity: computed,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }

  const bindings = [...request.bindings].map((binding) => {
    const from = pointerGet(loaded.get(binding.fromRole), binding.fromPointer);
    const to = pointerGet(loaded.get(binding.toRole), binding.toPointer);
    if (canonical(from) !== canonical(to)) {
      fail(`binding mismatch: ${binding.fromRole}${binding.fromPointer} != ${binding.toRole}${binding.toPointer}`);
    }
    return {
      fromRole: binding.fromRole,
      fromPointer: binding.fromPointer,
      toRole: binding.toRole,
      toPointer: binding.toPointer,
      valueSha256: sha256(canonical(from)),
    };
  }).sort((a, b) => canonical(a).localeCompare(canonical(b)));

  const result = {
    schema: SCHEMA,
    request: { bytes: requestBytes.length, sha256: sha256(requestBytes) },
    artifacts,
    bindings,
    policy: {
      hostedBuildAuthority: false,
      exactArtifactBytesRetained: true,
      logicalIdentitiesRecomputed: true,
      crossEvidenceBindingsVerified: true,
      overwriteExistingEvidence: false,
    },
  };
  result.identity = identityOf(result);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  compileTransaction(args.request, args.output).then((result) => {
    process.stdout.write(`${result.identity}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
