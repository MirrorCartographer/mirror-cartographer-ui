#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SBOM_SCHEMA = 'fia.cyclonedx-sbom.v1';
const PROVENANCE_SCHEMA = 'fia.release-provenance.v1';
const POLICY = Object.freeze({ hash: 'sha256', componentSource: 'npm-lockfile', evidenceBinding: 'exact-bytes-and-logical-identity' });
const hashBytes = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const identity = value => hashBytes(Buffer.from(stable(value)));
const fail = message => { throw new Error(message); };
async function exists(file) { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function writeExclusive(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, 'wx', 0o644);
  try { await handle.writeFile(`${stable(value)}\n`); } finally { await handle.close(); }
}
async function readJson(file) {
  const bytes = await fs.readFile(file);
  let value;
  try { value = JSON.parse(bytes); } catch { fail(`invalid JSON: ${file}`); }
  return { bytes, value, file: hashBytes(bytes) };
}
function requireSha(value, label) { if (!/^sha256:[0-9a-f]{64}$/.test(value || '')) fail(`invalid ${label}`); return value; }
function logicalIdentity(record, field, label) { return requireSha(record?.[field], `${label} identity`); }
function packageComponents(lock) {
  if (![2, 3].includes(lock.lockfileVersion) || !lock.packages || typeof lock.packages !== 'object') fail('package-lock must use lockfileVersion 2 or 3 with packages');
  const components = [];
  for (const [installPath, pkg] of Object.entries(lock.packages)) {
    if (!installPath) continue;
    if (!pkg?.name || !pkg?.version) fail(`dependency missing name or version: ${installPath}`);
    if (!pkg.integrity) fail(`dependency missing integrity: ${installPath}`);
    components.push({
      type: 'library',
      name: pkg.name,
      version: pkg.version,
      purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${encodeURIComponent(pkg.version)}`,
      integrity: pkg.integrity,
      installPath,
      development: Boolean(pkg.dev),
      optional: Boolean(pkg.optional)
    });
  }
  components.sort((a, b) => a.installPath.localeCompare(b.installPath));
  return components;
}
function verifyBundleManifest(manifest) {
  if (manifest.schema !== 'fia.portable-runtime-bundle.v1') fail('unsupported bundle manifest schema');
  requireSha(manifest.bundle, 'bundle identity');
  if (!manifest.artifacts?.current || !manifest.artifacts?.rollback) fail('bundle manifest requires current and rollback artifacts');
  return manifest.bundle;
}
function evidenceRef(read, field, schema, label) {
  if (read.value.schema !== schema) fail(`unsupported ${label} schema`);
  return { schema, file: read.file, identity: logicalIdentity(read.value, field, label) };
}
export async function compileReleaseEvidence(options) {
  const required = ['lockfile','build','staticValidation','runtimeVerification','bundleManifest','sourceCommit','sbom','provenance'];
  for (const key of required) if (!options[key]) fail(`missing option: ${key}`);
  if (!/^[0-9a-f]{40}$/.test(options.sourceCommit)) fail('sourceCommit must be a full 40-character lowercase commit SHA');
  if (await exists(options.sbom) || await exists(options.provenance)) fail('release evidence output already exists');
  const [lock, build, validation, runtime, bundle] = await Promise.all([
    readJson(options.lockfile), readJson(options.build), readJson(options.staticValidation), readJson(options.runtimeVerification), readJson(options.bundleManifest)
  ]);
  const bundleIdentity = verifyBundleManifest(bundle.value);
  const buildRef = evidenceRef(build, 'attestation', 'fia.clean-environment-build-attestation.v1', 'build attestation');
  const validationRef = evidenceRef(validation, 'validation', 'fia.static-artifact-validation.v1', 'static validation');
  const runtimeRef = evidenceRef(runtime, 'verification', 'fia.owned-runtime-verification.v1', 'runtime verification');
  const artifactIdentity = requireSha(build.value.outputInventory || build.value.artifact || build.value.output, 'build artifact identity');
  const validationArtifact = requireSha(validation.value.artifact, 'validation artifact identity');
  const runtimeArtifact = requireSha(runtime.value.artifact, 'runtime artifact identity');
  if (validationArtifact !== artifactIdentity) fail('static validation describes another artifact');
  if (runtimeArtifact !== artifactIdentity) fail('runtime verification describes another artifact');
  const runtimeBundle = runtime.value.bundle || runtime.value.portableBundle || bundleIdentity;
  if (runtimeBundle !== bundleIdentity) fail('runtime verification describes another bundle');
  const components = packageComponents(lock.value);
  const sbomCore = {
    schema: SBOM_SCHEMA,
    format: 'CycloneDX-compatible',
    specVersion: '1.6',
    policy: POLICY,
    sourceCommit: options.sourceCommit,
    lockfile: { file: lock.file, lockfileVersion: lock.value.lockfileVersion },
    components
  };
  const sbomRecord = { ...sbomCore, sbom: identity(sbomCore) };
  const provenanceCore = {
    schema: PROVENANCE_SCHEMA,
    policy: POLICY,
    sourceCommit: options.sourceCommit,
    subject: { artifact: artifactIdentity, bundle: bundleIdentity },
    materials: {
      lockfile: lock.file,
      sbom: sbomRecord.sbom,
      build: buildRef,
      staticValidation: validationRef,
      runtimeVerification: runtimeRef,
      bundleManifest: bundle.file
    }
  };
  if (options.buildRun) {
    const buildRun = await readJson(options.buildRun);
    provenanceCore.materials.buildRun = { file: buildRun.file, identity: logicalIdentity(buildRun.value, 'run', 'build run') };
  }
  const provenanceRecord = { ...provenanceCore, provenance: identity(provenanceCore) };
  await writeExclusive(options.sbom, sbomRecord);
  try { await writeExclusive(options.provenance, provenanceRecord); }
  catch (error) { await fs.rm(options.sbom, { force: true }); throw error; }
  return { sbom: sbomRecord, provenance: provenanceRecord };
}
function args(argv) { const out = {}; for (let i = 0; i < argv.length; i++) { const key = argv[i]; if (!key.startsWith('--')) fail(`unexpected argument: ${key}`); const value = argv[++i]; if (!value || value.startsWith('--')) fail(`missing value for ${key}`); out[key.slice(2)] = value; } return out; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = args(process.argv.slice(2));
  compileReleaseEvidence(a).then(result => console.log(result.provenance.provenance)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
