#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const value = (name, fallback) => { const index = argv.indexOf(name); return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : fallback; };
const root = resolve(value('--root', process.cwd()));
const input = resolve(root, value('--input', 'dist'));
const outRoot = resolve(root, value('--out', '.fia'));
const sourceDateEpoch = String(process.env.SOURCE_DATE_EPOCH || value('--source-date-epoch', '0'));
const skipCompile = has('--skip-compile');
const allowUnlocked = has('--allow-unlocked');

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const sortDeep = (value) => Array.isArray(value)
  ? value.map(sortDeep)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]))
    : value;
const canonical = (data) => `${JSON.stringify(sortDeep(data), null, 2)}\n`;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function exists(path) { try { await stat(path); return true; } catch { return false; } }

async function dependencyState() {
  const locks = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const present = [];
  for (const lock of locks) if (await exists(join(root, lock))) present.push(lock);
  if (!present.length && !allowUnlocked) throw new Error('Refusing non-reproducible build: no dependency lockfile found. Commit a lockfile or use --allow-unlocked for an explicitly non-reproducible experiment.');
  return { lockfiles: present, locked: present.length > 0 };
}

function run(command, commandArgs, log) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', env: { ...process.env, SOURCE_DATE_EPOCH: sourceDateEpoch } });
  log.push({ command: [command, ...commandArgs], status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} failed with status ${result.status}`);
}

async function main() {
  const normalizedTime = new Date(Number(sourceDateEpoch) * 1000).toISOString();
  const logs = [];
  const dependency = await dependencyState();
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });
  if (!skipCompile) run('npm', ['run', 'build'], logs);
  if (!await exists(input)) throw new Error(`Build input does not exist: ${input}`);

  const files = [];
  for (const file of await walk(input)) {
    const path = relative(input, file).split('\\').join('/');
    const bytes = await readFile(file);
    files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error(`Build input is empty: ${input}`);

  const identity = sha256(Buffer.from(files.map((file) => `${file.sha256}  ${file.path}\n`).join('')));
  const artifactDir = join(outRoot, 'artifacts', identity);
  const payloadDir = join(artifactDir, 'payload');
  await mkdir(payloadDir, { recursive: true });
  await cp(input, payloadDir, { recursive: true, force: true, preserveTimestamps: false });

  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const manifest = {
    schema: 'fia.artifact-manifest.v1', artifactId: `sha256:${identity}`, project: pkg.name,
    version: pkg.version, sourceDateEpoch, reproducible: dependency.locked, input: basename(input), files,
  };
  const sbom = {
    bomFormat: 'CycloneDX', specVersion: '1.5',
    serialNumber: `urn:uuid:${identity.slice(0,8)}-${identity.slice(8,12)}-${identity.slice(12,16)}-${identity.slice(16,20)}-${identity.slice(20,32)}`,
    version: 1, metadata: { component: { type: 'application', name: pkg.name, version: pkg.version } },
    components: Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
      .sort(([a], [b]) => a.localeCompare(b)).map(([name, version]) => ({ type: 'library', name, version })),
  };
  const provenance = {
    schema: 'fia.provenance.v1', artifactId: manifest.artifactId,
    builder: { id: 'foundation-intelligence-build-engine', version: '1' },
    invocation: { sourceDateEpoch, skipCompile, allowUnlocked }, materials: dependency.lockfiles,
    started: normalizedTime, finished: normalizedTime,
  };
  const rollback = { schema: 'fia.rollback.v1', artifactId: manifest.artifactId, activate: `artifacts/${identity}/payload`, previous: null };

  await writeFile(join(artifactDir, 'manifest.json'), canonical(manifest));
  await writeFile(join(artifactDir, 'sbom.cdx.json'), canonical(sbom));
  await writeFile(join(artifactDir, 'provenance.json'), canonical(provenance));
  await writeFile(join(artifactDir, 'rollback.json'), canonical(rollback));
  await writeFile(join(artifactDir, 'build.log.json'), canonical(logs));
  await writeFile(join(outRoot, 'current.json'), canonical({ artifactId: manifest.artifactId, path: `artifacts/${identity}` }));
  process.stdout.write(`${manifest.artifactId}\n`);
}

main().catch((error) => { console.error(`[fia build] ${error.message}`); process.exit(1); });
