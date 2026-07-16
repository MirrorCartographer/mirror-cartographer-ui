import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const MANIFEST_SCHEMA = 'foundation-intelligence-artifact/v1';
const RELEASE_SCHEMA = 'foundation-intelligence-release/v1';

function fail(message) { throw new Error(message); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function safeRelative(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\')) fail(`Unsafe artifact path: ${path}`);
  const normalized = path.split('/');
  if (normalized.some((part) => !part || part === '.' || part === '..')) fail(`Unsafe artifact path: ${path}`);
  return normalized.join('/');
}
function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
function atomicWrite(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, bytes, { flag: 'wx' });
  renameSync(temp, path);
}
function loadManifest(path) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.schema !== MANIFEST_SCHEMA) fail(`Unsupported manifest schema: ${manifest.schema}`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail('Manifest has no files.');
  if (!/^[a-f0-9]{64}$/.test(manifest.aggregateSha256 || '')) fail('Manifest aggregateSha256 is invalid.');
  return manifest;
}
function verifyArtifact(distRoot, manifest) {
  const seen = new Set();
  const records = [];
  for (const entry of [...manifest.files].sort((a, b) => String(a.path).localeCompare(String(b.path)))) {
    const path = safeRelative(entry.path);
    if (seen.has(path)) fail(`Duplicate manifest path: ${path}`);
    seen.add(path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 || '')) fail(`Invalid digest for ${path}`);
    const source = resolve(distRoot, path);
    if (!inside(distRoot, source) || !existsSync(source) || !statSync(source).isFile()) fail(`Missing artifact file: ${path}`);
    const bytes = readFileSync(source);
    const digest = sha256(bytes);
    if (digest !== entry.sha256) fail(`Digest mismatch: ${path}`);
    if (bytes.length !== entry.bytes) fail(`Size mismatch: ${path}`);
    records.push({ path, bytes: bytes.length, sha256: digest });
  }
  const aggregate = createHash('sha256');
  for (const file of records) aggregate.update(`${file.path}\0${file.sha256}\0${file.bytes}\n`);
  const calculated = aggregate.digest('hex');
  if (calculated !== manifest.aggregateSha256) fail(`Aggregate mismatch: expected ${manifest.aggregateSha256}, got ${calculated}`);
  return records;
}
export function ingest({ dist, manifestPath, store }) {
  const distRoot = resolve(dist);
  const storeRoot = resolve(store);
  const manifest = loadManifest(manifestPath);
  const files = verifyArtifact(distRoot, manifest);
  const blobs = [];
  for (const file of files) {
    const destination = join(storeRoot, 'blobs', 'sha256', file.sha256.slice(0, 2), file.sha256);
    if (existsSync(destination)) {
      const existing = readFileSync(destination);
      if (sha256(existing) !== file.sha256) fail(`Corrupt existing blob: ${file.sha256}`);
    } else {
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(distRoot, file.path), `${destination}.tmp-${process.pid}`);
      renameSync(`${destination}.tmp-${process.pid}`, destination);
    }
    blobs.push({ ...file, blob: `sha256:${file.sha256}` });
  }
  const release = {
    schema: RELEASE_SCHEMA,
    application: manifest.application,
    artifact: `sha256:${manifest.aggregateSha256}`,
    commit: manifest.commit,
    entrypoint: manifest.entrypoint,
    files: blobs,
  };
  const releaseBytes = `${canonical(release)}\n`;
  const releaseDigest = sha256(releaseBytes);
  const descriptor = join(storeRoot, 'releases', `${manifest.aggregateSha256}.json`);
  if (existsSync(descriptor) && readFileSync(descriptor, 'utf8') !== releaseBytes) fail(`Release identity collision: ${manifest.aggregateSha256}`);
  if (!existsSync(descriptor)) atomicWrite(descriptor, releaseBytes);
  return { artifact: release.artifact, releaseDigest: `sha256:${releaseDigest}`, descriptor, fileCount: files.length };
}
export function checkout({ artifact, store, destination }) {
  const digest = artifact.replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(digest)) fail(`Invalid artifact identity: ${artifact}`);
  const storeRoot = resolve(store);
  const target = resolve(destination);
  const release = JSON.parse(readFileSync(join(storeRoot, 'releases', `${digest}.json`), 'utf8'));
  if (release.schema !== RELEASE_SCHEMA || release.artifact !== `sha256:${digest}`) fail('Release descriptor identity mismatch.');
  const temp = `${target}.tmp-${process.pid}`;
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(temp, { recursive: true });
  for (const file of release.files) {
    const path = safeRelative(file.path);
    const blob = join(storeRoot, 'blobs', 'sha256', file.sha256.slice(0, 2), file.sha256);
    const bytes = readFileSync(blob);
    if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) fail(`Stored blob verification failed: ${file.sha256}`);
    const output = resolve(temp, path);
    if (!inside(temp, output)) fail(`Unsafe checkout path: ${path}`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes);
  }
  rmSync(target, { recursive: true, force: true });
  renameSync(temp, target);
  return { artifact: release.artifact, destination: target, fileCount: release.files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2);
  const flags = Object.fromEntries(args.reduce((pairs, value, index) => value.startsWith('--') ? [...pairs, [value.slice(2), args[index + 1]]] : pairs, []));
  try {
    const result = command === 'ingest'
      ? ingest({ dist: flags.dist || 'dist', manifestPath: flags.manifest || 'artifacts/manifest.json', store: flags.store || '.fia-store' })
      : command === 'checkout'
        ? checkout({ artifact: flags.artifact, store: flags.store || '.fia-store', destination: flags.destination || 'release' })
        : fail('Usage: artifact-store.mjs ingest|checkout [--dist PATH --manifest PATH --store PATH --artifact SHA --destination PATH]');
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
