import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const DEPLOYMENT_SCHEMA = 'foundation-intelligence-deployment/v1';
const RELEASE_SCHEMA = 'foundation-intelligence-release/v1';

function fail(message) { throw new Error(message); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
function safeRelative(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\')) fail(`Unsafe artifact path: ${path}`);
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) fail(`Unsafe artifact path: ${path}`);
  return parts.join('/');
}
function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`;
  writeFileSync(temp, text, { flag: 'wx' });
  renameSync(temp, path);
}
function artifactDigest(artifact) {
  const digest = String(artifact || '').replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(digest)) fail(`Invalid artifact identity: ${artifact}`);
  return digest;
}
function readCurrentArtifact(currentLink, releasesRoot) {
  let stat;
  try { stat = lstatSync(currentLink); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!stat.isSymbolicLink()) fail(`Current release pointer is not a symlink: ${currentLink}`);
  const target = resolve(dirname(currentLink), readlinkSync(currentLink));
  if (!inside(releasesRoot, target)) fail('Current release pointer escapes releases root.');
  const marker = join(target, '.fia-artifact');
  if (!existsSync(marker)) fail('Current release lacks artifact identity marker.');
  return readFileSync(marker, 'utf8').trim();
}
function checkout(storeRoot, digest, destination) {
  const descriptorPath = join(storeRoot, 'releases', `${digest}.json`);
  if (!existsSync(descriptorPath)) fail(`Missing release descriptor: sha256:${digest}`);
  const release = JSON.parse(readFileSync(descriptorPath, 'utf8'));
  if (release.schema !== RELEASE_SCHEMA || release.artifact !== `sha256:${digest}` || !Array.isArray(release.files)) fail('Release descriptor identity mismatch.');
  mkdirSync(destination, { recursive: false });
  for (const file of release.files) {
    const path = safeRelative(file.path);
    if (!/^[a-f0-9]{64}$/.test(file.sha256 || '') || !Number.isSafeInteger(file.bytes) || file.bytes < 0) fail(`Invalid release record: ${path}`);
    const blob = join(storeRoot, 'blobs', 'sha256', file.sha256.slice(0, 2), file.sha256);
    const bytes = readFileSync(blob);
    if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) fail(`Stored blob verification failed: ${file.sha256}`);
    const output = resolve(destination, path);
    if (!inside(destination, output)) fail(`Unsafe checkout path: ${path}`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, bytes, { flag: 'wx' });
  }
  writeFileSync(join(destination, '.fia-artifact'), `sha256:${digest}\n`, { flag: 'wx' });
  return release;
}
function runHealth(command, cwd, artifact) {
  if (!command) return { command: null, status: 'skipped' };
  const result = execFileSync(process.execPath, ['-e', command], {
    cwd,
    env: { ...process.env, FIA_RELEASE_DIR: cwd, FIA_ARTIFACT: artifact },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  });
  return { command, status: 'passed', outputSha256: sha256(result) };
}
function switchSymlink(currentLink, target) {
  mkdirSync(dirname(currentLink), { recursive: true });
  const temp = `${currentLink}.tmp-${process.pid}-${randomUUID()}`;
  symlinkSync(relative(dirname(currentLink), target), temp, 'dir');
  renameSync(temp, currentLink);
}
function pruneReleases(releasesRoot, keep, protectedTargets) {
  const entries = [];
  for (const name of existsSync(releasesRoot) ? readdirSync(releasesRoot) : []) {
    const path = join(releasesRoot, name);
    if (!lstatSync(path).isDirectory() || name.startsWith('.stage-')) continue;
    entries.push({ name, path, mtime: lstatSync(path).mtimeMs });
  }
  entries.sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
  for (const entry of entries.slice(keep)) if (!protectedTargets.has(resolve(entry.path))) rmSync(entry.path, { recursive: true, force: true });
}

export function deploy({ artifact, store, root, healthCommand = null, retain = 3 }) {
  const digest = artifactDigest(artifact);
  const storeRoot = resolve(store);
  const deploymentRoot = resolve(root);
  const releasesRoot = join(deploymentRoot, 'releases');
  const currentLink = join(deploymentRoot, 'current');
  const historyRoot = join(deploymentRoot, 'history');
  mkdirSync(releasesRoot, { recursive: true });
  mkdirSync(historyRoot, { recursive: true });

  const previousArtifact = readCurrentArtifact(currentLink, releasesRoot);
  const finalRelease = join(releasesRoot, digest);
  const stage = join(releasesRoot, `.stage-${digest}-${process.pid}-${randomUUID()}`);
  let promoted = false;
  try {
    if (!existsSync(finalRelease)) {
      checkout(storeRoot, digest, stage);
      const health = runHealth(healthCommand, stage, `sha256:${digest}`);
      renameSync(stage, finalRelease);
      switchSymlink(currentLink, finalRelease);
      promoted = true;
      const record = {
        schema: DEPLOYMENT_SCHEMA,
        artifact: `sha256:${digest}`,
        previousArtifact,
        health,
        state: 'promoted',
      };
      const bytes = `${canonical(record)}\n`;
      const identity = sha256(bytes);
      atomicWrite(join(historyRoot, `${identity}.json`), bytes);
      const protectedTargets = new Set([resolve(finalRelease)]);
      if (previousArtifact) protectedTargets.add(join(releasesRoot, artifactDigest(previousArtifact)));
      pruneReleases(releasesRoot, Math.max(2, Number(retain) || 3), protectedTargets);
      return { ...record, deployment: `sha256:${identity}`, current: currentLink };
    }
    runHealth(healthCommand, finalRelease, `sha256:${digest}`);
    switchSymlink(currentLink, finalRelease);
    promoted = true;
    return { schema: DEPLOYMENT_SCHEMA, artifact: `sha256:${digest}`, previousArtifact, state: 'promoted-existing', current: currentLink };
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    if (promoted && previousArtifact) switchSymlink(currentLink, join(releasesRoot, artifactDigest(previousArtifact)));
    throw error;
  }
}

export function rollback({ root, artifact = null }) {
  const deploymentRoot = resolve(root);
  const releasesRoot = join(deploymentRoot, 'releases');
  const currentLink = join(deploymentRoot, 'current');
  const currentArtifact = readCurrentArtifact(currentLink, releasesRoot);
  if (!currentArtifact) fail('No current release to roll back.');
  let targetArtifact = artifact;
  if (!targetArtifact) {
    const candidates = readdirSync(releasesRoot)
      .filter((name) => /^[a-f0-9]{64}$/.test(name) && `sha256:${name}` !== currentArtifact)
      .map((name) => ({ name, mtime: lstatSync(join(releasesRoot, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
    if (!candidates.length) fail('No retained release is available for rollback.');
    targetArtifact = `sha256:${candidates[0].name}`;
  }
  const digest = artifactDigest(targetArtifact);
  const target = join(releasesRoot, digest);
  if (!existsSync(target) || readFileSync(join(target, '.fia-artifact'), 'utf8').trim() !== `sha256:${digest}`) fail(`Rollback target is unavailable or invalid: sha256:${digest}`);
  switchSymlink(currentLink, target);
  return { schema: DEPLOYMENT_SCHEMA, from: currentArtifact, artifact: `sha256:${digest}`, state: 'rolled-back', current: currentLink };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2);
  const flags = Object.fromEntries(args.reduce((pairs, value, index) => value.startsWith('--') ? [...pairs, [value.slice(2), args[index + 1]]] : pairs, []));
  try {
    const result = command === 'deploy'
      ? deploy({ artifact: flags.artifact, store: flags.store || '.fia-store', root: flags.root || '.fia-deploy', healthCommand: flags.health || null, retain: flags.retain || 3 })
      : command === 'rollback'
        ? rollback({ root: flags.root || '.fia-deploy', artifact: flags.artifact || null })
        : fail('Usage: deploy-release.mjs deploy|rollback [--artifact SHA --store PATH --root PATH --health JS --retain N]');
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
