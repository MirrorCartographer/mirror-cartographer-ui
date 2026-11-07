#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm, lstat } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.owned-listener-promotion.v1';
const REQUEST_SCHEMA = 'fia.owned-listener-promotion-request.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}
function bytes(value) { return Buffer.from(JSON.stringify(canonical(value))); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}
function validateEndpoint(value, label) {
  if (!value || typeof value !== 'object') fail(`${label} must be an object`);
  for (const field of ['releaseIdentity', 'healthIdentity', 'listenerId', 'contentSha256']) {
    if (typeof value[field] !== 'string' || !value[field]) fail(`${label}.${field} must be a non-empty string`);
  }
  if (!/^[a-f0-9]{64}$/.test(value.contentSha256)) fail(`${label}.contentSha256 must be sha256`);
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) fail(`${label}.port must be a valid port`);
  if (value.host !== '127.0.0.1' && value.host !== '::1') fail(`${label}.host must be loopback`);
  return canonical(value);
}
function verifyHealthBinding(endpoint, publicProbe, label) {
  if (publicProbe.releaseIdentity !== endpoint.releaseIdentity) fail(`${label} release mismatch`);
  if (publicProbe.contentSha256 !== endpoint.contentSha256) fail(`${label} content mismatch`);
  if (publicProbe.healthIdentity !== endpoint.healthIdentity) fail(`${label} health mismatch`);
  if (publicProbe.listenerId !== endpoint.listenerId) fail(`${label} listener mismatch`);
}
async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeExclusiveAtomic(file, payload) {
  await mkdir(path.dirname(file), { recursive: true });
  try { await lstat(file); fail(`refusing to overwrite ${file}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, payload, { flag: 'wx', mode: 0o600 });
  try { await rename(tmp, file); } catch (e) { await rm(tmp, { force: true }); throw e; }
}

export async function promote({ requestPath, statePath, outputPath, injectFailure = '' }) {
  const requestBytes = await readFile(requestPath);
  const request = JSON.parse(requestBytes);
  if (request.schema !== REQUEST_SCHEMA) fail(`expected ${REQUEST_SCHEMA}`);
  const candidate = validateEndpoint(request.candidate, 'candidate');
  const previous = request.previous ? validateEndpoint(request.previous, 'previous') : null;
  if (!request.privateProbe || !request.publicProbe) fail('privateProbe and publicProbe are required');
  verifyHealthBinding(candidate, request.privateProbe, 'private probe');
  verifyHealthBinding(candidate, request.publicProbe, 'public probe');
  if (candidate.listenerId === previous?.listenerId) fail('candidate listener must differ from previous listener');
  if (previous && candidate.releaseIdentity === previous.releaseIdentity) fail('candidate release must differ from previous release');

  let current = null;
  try { current = await readJson(statePath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (previous) {
    if (!current) fail('previous listener declared but state is absent');
    for (const field of ['releaseIdentity','healthIdentity','listenerId','contentSha256','host','port']) {
      if (current[field] !== previous[field]) fail(`active state mismatch at ${field}`);
    }
  } else if (current) fail('active state exists but request declares no previous listener');

  const logicalRequest = canonical({ schema: request.schema, candidate, previous, privateProbe: canonical(request.privateProbe), publicProbe: canonical(request.publicProbe), policy: { atomicReplace: true, rollbackRequired: true, loopbackCandidateRequired: true, publicReprobeRequired: true } });
  const requestIdentity = sha256(bytes(logicalRequest));
  const statePayload = `${JSON.stringify(candidate, null, 2)}\n`;
  const backupPath = `${statePath}.rollback-${requestIdentity}`;
  await mkdir(path.dirname(statePath), { recursive: true });

  let switched = false;
  try {
    if (previous) await writeExclusiveAtomic(backupPath, `${JSON.stringify(previous, null, 2)}\n`);
    const tmp = `${statePath}.candidate-${requestIdentity}`;
    await writeFile(tmp, statePayload, { flag: 'wx', mode: 0o600 });
    await rename(tmp, statePath);
    switched = true;
    if (injectFailure === 'after-switch') fail('injected failure after switch');
    const active = await readJson(statePath);
    verifyHealthBinding(candidate, active, 'active state');
    if (active.host !== candidate.host || active.port !== candidate.port) fail('active endpoint mismatch');
  } catch (error) {
    if (switched) {
      if (previous) {
        const rollbackTmp = `${statePath}.restore-${requestIdentity}`;
        await writeFile(rollbackTmp, `${JSON.stringify(previous, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        await rename(rollbackTmp, statePath);
        const restored = await readJson(statePath);
        verifyHealthBinding(previous, restored, 'rollback state');
      } else {
        await rm(statePath, { force: true });
      }
    }
    await rm(backupPath, { force: true });
    throw error;
  }

  await rm(backupPath, { force: true });
  const evidenceBase = canonical({ schema: SCHEMA, requestIdentity, candidate, previous, switched: true, publicReprobeVerified: true, rollbackPrepared: Boolean(previous), policy: logicalRequest.policy });
  const evidence = { ...evidenceBase, identity: sha256(bytes(evidenceBase)) };
  await writeExclusiveAtomic(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  if (!args.request || !args.state || !args.output) fail('usage: --request <json> --state <json> --output <json>');
  promote({ requestPath: args.request, statePath: args.state, outputPath: args.output, injectFailure: args.injectFailure ?? '' })
    .then(e => process.stdout.write(`${JSON.stringify({ schema: e.schema, identity: e.identity })}\n`))
    .catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
}
