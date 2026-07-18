#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SBOM_SCHEMA = 'fia.cyclonedx-sbom.v1';
const PROVENANCE_SCHEMA = 'fia.release-provenance.v1';
const BUNDLE_SCHEMA = 'fia.portable-runtime-bundle.v1';
const GRAPH_SCHEMA = 'fia.release-evidence-graph.v1';
const SHA_RE = /^sha256:[0-9a-f]{64}$/;

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

const bytesOf = (value) => Buffer.from(`${canonical(value)}\n`);
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const identify = (core) => ({ ...core, identity: sha256(Buffer.from(canonical(core))) });

function fail(message) { throw new Error(message); }
function expectCommit(value) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) fail('source commit must be a full lowercase git SHA-1');
}
function expectIdentity(record, label, canonicalizer = canonical) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`${label} must be an object`);
  if (!SHA_RE.test(record.identity ?? '')) fail(`${label} has invalid identity`);
  const copy = structuredClone(record);
  delete copy.identity;
  const actual = sha256(Buffer.from(canonicalizer(copy)));
  if (actual !== record.identity) fail(`${label} identity mismatch`);
}
function stablePretty(value) {
  const stable = (v) => Array.isArray(v) ? v.map(stable)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}
function verifyProducerBundle(bundle) {
  if (bundle.schema !== BUNDLE_SCHEMA) fail('unsupported bundle schema');
  const copy = structuredClone(bundle);
  delete copy.identity;
  const expected = sha256(Buffer.from(stablePretty(copy)));
  if (bundle.identity !== expected) fail('producer bundle identity mismatch');
  for (const name of ['current', 'rollback']) {
    const artifact = bundle.artifacts?.[name];
    if (!artifact || !Array.isArray(artifact.files) || !Array.isArray(artifact.routes)) fail(`bundle missing ${name} artifact`);
    if (!artifact.routes.length) fail(`bundle ${name} has no routes`);
  }
}
function normalizeDependencies(packageJson) {
  const rows = [];
  for (const [scope, development] of [['dependencies', false], ['devDependencies', true], ['optionalDependencies', false], ['peerDependencies', false]]) {
    const deps = packageJson[scope] ?? {};
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) fail(`${scope} must be an object`);
    for (const [name, requested] of Object.entries(deps)) {
      if (typeof requested !== 'string' || !requested.trim()) fail(`invalid dependency request for ${name}`);
      rows.push({ name, requested, scope, development, integrity: null, resolved: null, verification: 'unlocked-request' });
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));
  return rows;
}
async function readJson(file) {
  const bytes = await fs.readFile(file);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(`invalid JSON: ${file}`); }
  return { bytes, value };
}
async function writeExclusive(file, bytes, mode = 0o444) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, 'wx', mode);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
}
async function cleanup(files) { await Promise.all(files.map((f) => fs.rm(f, { force: true }))); }

export async function compileReleaseEvidenceGraph({ bundleManifest, packageJson, sourceCommit, sbom, provenance, boundBundle, graph }) {
  expectCommit(sourceCommit);
  const destinations = [sbom, provenance, boundBundle, graph].filter(Boolean);
  if (new Set(destinations.map((f) => path.resolve(f))).size !== destinations.length) fail('output paths must be distinct');
  for (const file of destinations) {
    try { await fs.lstat(file); fail(`output exists: ${file}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const [bundleFile, packageFile] = await Promise.all([readJson(bundleManifest), readJson(packageJson)]);
  verifyProducerBundle(bundleFile.value);
  const pkg = packageFile.value;
  if (!pkg || typeof pkg !== 'object' || typeof pkg.name !== 'string' || typeof pkg.version !== 'string') fail('package.json requires name and version');
  const components = normalizeDependencies(pkg);
  const sbomCore = {
    schema: SBOM_SCHEMA,
    format: 'CycloneDX-compatible',
    sourceCommit,
    root: { name: pkg.name, version: pkg.version },
    dependencyAuthority: { type: 'package.json', file: sha256(packageFile.bytes), locked: false },
    components,
  };
  const sbomRecord = identify(sbomCore);

  const bundleAnchor = structuredClone(bundleFile.value);
  delete bundleAnchor.identity;
  delete bundleAnchor.provenanceIdentity;
  delete bundleAnchor.sbomIdentity;
  delete bundleAnchor.bundleAnchorIdentity;
  const bundleAnchorIdentity = sha256(Buffer.from(canonical(bundleAnchor)));
  const provenanceCore = {
    schema: PROVENANCE_SCHEMA,
    sourceCommit,
    bundleIdentity: bundleAnchorIdentity,
    producerBundleIdentity: bundleFile.value.identity,
    producerBundleFile: sha256(bundleFile.bytes),
    sbomIdentity: sbomRecord.identity,
    packageFile: sha256(packageFile.bytes),
    dependencyReproducibility: 'not-proven-without-lockfile',
  };
  const provenanceRecord = identify(provenanceCore);
  const boundBundleCore = {
    ...bundleAnchor,
    bundleAnchorIdentity,
    sbomIdentity: sbomRecord.identity,
    provenanceIdentity: provenanceRecord.identity,
  };
  const boundBundleRecord = identify(boundBundleCore);
  expectIdentity(sbomRecord, 'SBOM');
  expectIdentity(provenanceRecord, 'provenance');
  expectIdentity(boundBundleRecord, 'bound bundle');

  const graphCore = {
    schema: GRAPH_SCHEMA,
    sourceCommit,
    producerBundle: bundleFile.value.identity,
    bundleAnchor: bundleAnchorIdentity,
    boundBundle: boundBundleRecord.identity,
    sbom: sbomRecord.identity,
    provenance: provenanceRecord.identity,
    dependencyReproducibility: false,
  };
  const graphRecord = identify(graphCore);
  const writes = [
    [sbom, bytesOf(sbomRecord)],
    [provenance, bytesOf(provenanceRecord)],
    [boundBundle, bytesOf(boundBundleRecord)],
    ...(graph ? [[graph, bytesOf(graphRecord)]] : []),
  ];
  const written = [];
  try {
    for (const [file, bytes] of writes) { await writeExclusive(file, bytes); written.push(file); }
  } catch (error) {
    await cleanup(written);
    throw error;
  }
  return { sbom: sbomRecord, provenance: provenanceRecord, bundle: boundBundleRecord, graph: graphRecord };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) fail(`unexpected argument: ${item}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail(`missing value for ${item}`);
    args[item.slice(2)] = value;
  }
  return args;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ['bundleManifest', 'packageJson', 'sourceCommit', 'sbom', 'provenance', 'boundBundle']) if (!args[key]) fail(`--${key} is required`);
  const result = await compileReleaseEvidenceGraph(args);
  process.stdout.write(`${JSON.stringify({ status: 'accepted', schema: GRAPH_SCHEMA, identity: result.graph.identity })}\n`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
