#!/usr/bin/env node
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCHEMA = 'fia.provenance.v1';
const SIG_SCHEMA = 'fia.provenance-signature.v1';
const sha256 = value => createHash('sha256').update(value).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const out = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i];
    if (!key.startsWith('--')) fail(`unexpected argument: ${key}`);
    const value = rest[++i];
    if (value === undefined || value.startsWith('--')) fail(`missing value for ${key}`);
    out[key.slice(2)] = value;
  }
  return out;
}

function readJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { fail(`${label} is not valid JSON: ${error.message}`); }
}

function identity(value, label) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    fail(`${label} must be a lowercase sha256 identity`);
  }
  return value;
}

function commit(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    fail('source commit must be a full lowercase 40-character Git SHA');
  }
  return value;
}

function evidence(path, label) {
  const value = readJson(path, label);
  return {
    identity: `sha256:${sha256(Buffer.from(canonical(value)))}`,
    schema: value.schema ?? null
  };
}

export function buildStatement(input) {
  const statement = {
    schema: SCHEMA,
    subject: { artifact: identity(input.artifact, 'artifact') },
    source: {
      repository: input.repository,
      commit: commit(input.commit)
    },
    build: {
      command: input.command,
      environment: input.environment
    },
    evidence: {
      lockfile: evidence(input.lockfile, 'lockfile'),
      dependencyPolicy: evidence(input.policy, 'dependency policy'),
      reproducibility: evidence(input.reproducibility, 'reproducibility attestation'),
      manifest: evidence(input.manifest, 'artifact manifest'),
      sbom: evidence(input.sbom, 'SBOM')
    }
  };

  if (!/^https?:\/\/|^ssh:\/\//.test(statement.source.repository)) {
    fail('repository must be an explicit HTTP(S) or SSH URL');
  }
  if (!statement.build.command) fail('build command is required');
  if (!statement.build.environment) fail('environment contract is required');

  const bytes = Buffer.from(canonical(statement));
  return {
    statement,
    bytes,
    identity: `sha256:${sha256(bytes)}`
  };
}

function exclusive(path, content) {
  writeFileSync(resolve(path), content, { flag: 'wx', mode: 0o600 });
}

export function createKeypair(privatePath, publicPath) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  exclusive(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  exclusive(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
}

export function attest(options) {
  const built = buildStatement(options);
  const privateKey = readFileSync(options['private-key']);
  const signature = sign(null, built.bytes, privateKey).toString('base64');
  const envelope = {
    schema: SIG_SCHEMA,
    provenance: built.statement,
    provenanceIdentity: built.identity,
    signature: { algorithm: 'Ed25519', value: signature }
  };
  exclusive(options.output, `${canonical(envelope)}\n`);
  return envelope;
}

export function verifyEnvelope(path, publicKeyPath) {
  const envelope = readJson(path, 'provenance envelope');
  if (envelope.schema !== SIG_SCHEMA) fail('unsupported provenance signature schema');
  if (envelope.signature?.algorithm !== 'Ed25519' || typeof envelope.signature.value !== 'string') {
    fail('invalid signature metadata');
  }

  const bytes = Buffer.from(canonical(envelope.provenance));
  const expected = `sha256:${sha256(bytes)}`;
  if (envelope.provenanceIdentity !== expected) fail('provenance identity mismatch');
  if (!verify(null, bytes, readFileSync(publicKeyPath), Buffer.from(envelope.signature.value, 'base64'))) {
    fail('signature verification failed');
  }

  return {
    schema: 'fia.provenance-verification.v1',
    provenanceIdentity: expected,
    verified: true
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'generate-key') {
    if (!args['private-key'] || !args['public-key']) {
      fail('generate-key requires --private-key and --public-key');
    }
    createKeypair(args['private-key'], args['public-key']);
    console.log(JSON.stringify({ schema: 'fia.signing-keypair.v1', publicKey: resolve(args['public-key']) }));
    return;
  }

  if (args.command === 'attest') {
    for (const key of ['artifact', 'repository', 'commit', 'command', 'environment', 'lockfile', 'policy', 'reproducibility', 'manifest', 'sbom', 'private-key', 'output']) {
      if (!args[key]) fail(`attest requires --${key}`);
    }
    const environment = readJson(args.environment, 'environment contract');
    const envelope = attest({ ...args, environment });
    console.log(JSON.stringify({ schema: SIG_SCHEMA, provenanceIdentity: envelope.provenanceIdentity, output: resolve(args.output) }));
    return;
  }

  if (args.command === 'verify') {
    if (!args.input || !args['public-key']) fail('verify requires --input and --public-key');
    console.log(JSON.stringify(verifyEnvelope(args.input, args['public-key'])));
    return;
  }

  fail('command must be generate-key, attest, or verify');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); }
  catch (error) {
    console.error(`fia provenance: ${error.message}`);
    process.exitCode = 1;
  }
}
