#!/usr/bin/env node
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.release-evidence-seal.v1';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function fail(message) {
  throw new Error(message);
}

async function readJson(file) {
  const bytes = await readFile(file);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch { fail(`invalid JSON: ${file}`); }
  return { bytes, value };
}

function expectIdentity(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`${label} must be an object`);
  if (!/^sha256:[0-9a-f]{64}$/.test(record.identity ?? '')) fail(`${label} has invalid identity`);
  const copy = structuredClone(record);
  delete copy.identity;
  const actual = sha256(Buffer.from(canonical(copy)));
  if (actual !== record.identity) fail(`${label} identity mismatch`);
  return actual;
}

function expectSourceCommit(value, label) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) fail(`${label} sourceCommit must be a full lowercase git SHA-1`);
}

function validateBindings(bundle, sbom, provenance) {
  if (bundle.schema !== 'fia.portable-runtime-bundle.v1') fail('unsupported bundle manifest schema');
  if (sbom.schema !== 'fia.cyclonedx-sbom.v1') fail('unsupported SBOM schema');
  if (provenance.schema !== 'fia.release-provenance.v1') fail('unsupported provenance schema');

  const bundleIdentity = expectIdentity(bundle, 'bundle manifest');
  const sbomIdentity = expectIdentity(sbom, 'SBOM');
  const provenanceIdentity = expectIdentity(provenance, 'provenance');
  expectSourceCommit(sbom.sourceCommit, 'SBOM');
  expectSourceCommit(provenance.sourceCommit, 'provenance');

  if (sbom.sourceCommit !== provenance.sourceCommit) fail('SBOM and provenance source commits differ');
  if (provenance.sbomIdentity !== sbomIdentity) fail('provenance does not bind the supplied SBOM');
  const bundleAnchor = structuredClone(bundle);
  delete bundleAnchor.identity;
  delete bundleAnchor.provenanceIdentity;
  delete bundleAnchor.bundleAnchorIdentity;
  const bundleAnchorIdentity = sha256(Buffer.from(canonical(bundleAnchor)));
  if (bundle.bundleAnchorIdentity !== bundleAnchorIdentity) fail('bundle anchor identity mismatch');
  if (provenance.bundleIdentity !== bundleAnchorIdentity) fail('provenance does not bind the supplied bundle anchor');
  if (bundle.provenanceIdentity !== provenanceIdentity) fail('bundle manifest does not bind the supplied provenance');
  if (bundle.sbomIdentity !== sbomIdentity) fail('bundle manifest does not bind the supplied SBOM');

  return { bundleIdentity, sbomIdentity, provenanceIdentity, sourceCommit: sbom.sourceCommit };
}

function parseArgs(argv) {
  const args = { action: 'seal' };
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) fail(`unexpected argument: ${item}`);
    const key = item.slice(2);
    if (key === 'action') args.action = argv[++i];
    else args[key] = argv[++i];
  }
  return args;
}

function requireArgs(args, names) {
  for (const name of names) if (!args[name]) fail(`missing --${name}`);
}

async function buildSeal(args) {
  requireArgs(args, ['bundleManifest', 'sbom', 'provenance', 'privateKey', 'publicKey', 'output']);
  const [bundleFile, sbomFile, provenanceFile, privatePem, publicPem] = await Promise.all([
    readJson(args.bundleManifest), readJson(args.sbom), readJson(args.provenance), readFile(args.privateKey), readFile(args.publicKey)
  ]);
  const bindings = validateBindings(bundleFile.value, sbomFile.value, provenanceFile.value);
  const publicKey = createPublicKey(publicPem);
  const privateKey = createPrivateKey(privatePem);
  const derivedPublic = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const suppliedPublic = publicKey.export({ type: 'spki', format: 'der' });
  if (!Buffer.from(derivedPublic).equals(Buffer.from(suppliedPublic))) fail('private and public keys do not match');

  const payload = {
    schema: SCHEMA,
    algorithm: 'Ed25519',
    sourceCommit: bindings.sourceCommit,
    bundle: { path: path.basename(args.bundleManifest), file: sha256(bundleFile.bytes), identity: bindings.bundleIdentity },
    sbom: { path: path.basename(args.sbom), file: sha256(sbomFile.bytes), identity: bindings.sbomIdentity },
    provenance: { path: path.basename(args.provenance), file: sha256(provenanceFile.bytes), identity: bindings.provenanceIdentity },
    publicKey: sha256(suppliedPublic)
  };
  const message = Buffer.from(canonical(payload));
  const signature = sign(null, message, privateKey).toString('base64');
  const seal = { ...payload, signature, identity: sha256(Buffer.from(canonical({ ...payload, signature }))) };
  if (!verify(null, message, publicKey, Buffer.from(signature, 'base64'))) fail('signature self-verification failed');
  await writeFile(args.output, `${canonical(seal)}\n`, { flag: 'wx', mode: 0o600 });
  return seal;
}

async function verifySeal(args) {
  requireArgs(args, ['bundleManifest', 'sbom', 'provenance', 'publicKey', 'seal']);
  const [bundleFile, sbomFile, provenanceFile, sealFile, publicPem] = await Promise.all([
    readJson(args.bundleManifest), readJson(args.sbom), readJson(args.provenance), readJson(args.seal), readFile(args.publicKey)
  ]);
  const bindings = validateBindings(bundleFile.value, sbomFile.value, provenanceFile.value);
  const seal = sealFile.value;
  if (seal.schema !== SCHEMA || seal.algorithm !== 'Ed25519') fail('unsupported seal');
  const sealCopy = structuredClone(seal);
  delete sealCopy.identity;
  if (sha256(Buffer.from(canonical(sealCopy))) !== seal.identity) fail('seal identity mismatch');
  if (seal.bundle.file !== sha256(bundleFile.bytes) || seal.bundle.identity !== bindings.bundleIdentity) fail('sealed bundle mismatch');
  if (seal.sbom.file !== sha256(sbomFile.bytes) || seal.sbom.identity !== bindings.sbomIdentity) fail('sealed SBOM mismatch');
  if (seal.provenance.file !== sha256(provenanceFile.bytes) || seal.provenance.identity !== bindings.provenanceIdentity) fail('sealed provenance mismatch');
  if (seal.sourceCommit !== bindings.sourceCommit) fail('sealed source commit mismatch');
  const publicKey = createPublicKey(publicPem);
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  if (seal.publicKey !== sha256(publicDer)) fail('seal public key mismatch');
  const payload = structuredClone(seal);
  delete payload.identity;
  delete payload.signature;
  if (!verify(null, Buffer.from(canonical(payload)), publicKey, Buffer.from(seal.signature, 'base64'))) fail('invalid release evidence signature');
  return seal;
}

const args = parseArgs(process.argv);
try {
  const result = args.action === 'seal' ? await buildSeal(args)
    : args.action === 'verify' ? await verifySeal(args)
      : fail(`unsupported action: ${args.action}`);
  process.stdout.write(`${JSON.stringify({ status: 'accepted', schema: SCHEMA, identity: result.identity })}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
