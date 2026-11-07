#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.owned-release-activation.v1';
const IMPORT_SCHEMA = 'fia.owned-registry-import.v1';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function logicalIdentity(record) {
  const copy = structuredClone(record);
  delete copy.identity;
  return sha256Bytes(Buffer.from(canonical(copy)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeName(value, label) {
  assert(typeof value === 'string' && /^[a-zA-Z0-9._-]+$/.test(value), `${label} is unsafe`);
  return value;
}

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function hashFile(file) {
  const bytes = await readFile(file);
  return { size: bytes.length, sha256: sha256Bytes(bytes) };
}

async function inventoryTree(root) {
  const inventory = [];
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      assert(!entry.isSymbolicLink(), `symlink rejected: ${relative}`);
      const stat = await lstat(absolute);
      if (entry.isDirectory()) {
        inventory.push({ path: relative, type: 'directory', mode: stat.mode & 0o777 });
        await walk(absolute, relative);
      } else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        inventory.push({ path: relative, type: 'file', mode: stat.mode & 0o777, size: bytes.length, sha256: sha256Bytes(bytes) });
      } else {
        throw new Error(`unsupported runtime entry: ${relative}`);
      }
    }
  }
  await walk(root);
  return inventory;
}

async function staticChecks(root) {
  const indexPath = path.join(root, 'index.html');
  assert(await exists(indexPath), 'runtime missing index.html');
  const html = await readFile(indexPath, 'utf8');
  const checks = {
    indexPresent: true,
    viewportPresent: /<meta\s+[^>]*name=["']viewport["']/i.test(html),
    languagePresent: /<html\s+[^>]*lang=["'][^"']+["']/i.test(html),
    noAutoplay: !(/\bautoplay\b/i.test(html)),
    noProviderRuntimeCoupling: !(/vercel|cloudflare|github\.io/i.test(html)),
  };
  for (const [name, passed] of Object.entries(checks)) assert(passed, `static check failed: ${name}`);
  return checks;
}

async function atomicPointer(pointerPath, target) {
  await mkdir(path.dirname(pointerPath), { recursive: true });
  const temporary = `${pointerPath}.tmp-${process.pid}-${Date.now()}`;
  await symlink(target, temporary, 'dir');
  await rename(temporary, pointerPath);
}

async function materializeBundle(bundlePath, destination) {
  const bytes = await readFile(bundlePath);
  const bundle = JSON.parse(bytes.toString('utf8'));
  assert(bundle.schema === 'fia.static-runtime-bundle.v1', 'unsupported runtime bundle schema');
  assert(bundle.files && typeof bundle.files === 'object' && !Array.isArray(bundle.files), 'runtime bundle files are invalid');
  for (const relative of Object.keys(bundle.files).sort()) {
    assert(!path.isAbsolute(relative) && !relative.split('/').includes('..'), 'runtime bundle path escape');
    assert(typeof bundle.files[relative] === 'string', `runtime bundle file must be UTF-8 text: ${relative}`);
    const destinationPath = path.join(destination, relative);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, bundle.files[relative], { flag: 'wx' });
  }
}

export async function activate({ importFile, runtimeSource, stateDir, releaseName, output, injectPostSwitchFailure = false }) {
  const importBytes = await readFile(importFile);
  const imported = JSON.parse(importBytes);
  assert(imported.schema === IMPORT_SCHEMA, `expected ${IMPORT_SCHEMA}`);
  assert(imported.identity === logicalIdentity(imported), 'registry import identity mismatch');
  safeName(releaseName, 'releaseName');

  const runtime = imported.runtime;
  assert(runtime && /^[a-f0-9]{64}$/.test(runtime.sha256), 'registry import missing runtime digest');
  assert(Number.isSafeInteger(runtime.size) && runtime.size >= 0, 'registry import missing runtime size');
  const sourceIdentity = await hashFile(runtimeSource);
  assert(sourceIdentity.sha256 === runtime.sha256 && sourceIdentity.size === runtime.size, 'runtime source bytes do not match registry import');

  await mkdir(stateDir, { recursive: true });
  const releasesDir = path.join(stateDir, 'releases');
  await mkdir(releasesDir, { recursive: true });
  const releaseId = `${releaseName}-${runtime.sha256}`;
  const finalDirectory = path.join(releasesDir, releaseId);
  const stagingDirectory = `${finalDirectory}.staging-${process.pid}`;
  const activePointer = path.join(stateDir, 'active');
  assert(!(await exists(finalDirectory)), 'immutable release already exists');
  await mkdir(stagingDirectory, { recursive: false });
  let previousTarget = null;

  try {
    await materializeBundle(runtimeSource, stagingDirectory);
    const inventoryBeforeSwitch = await inventoryTree(stagingDirectory);
    const checks = await staticChecks(stagingDirectory);
    await rename(stagingDirectory, finalDirectory);

    if (await exists(activePointer)) previousTarget = await readlink(activePointer);
    await atomicPointer(activePointer, finalDirectory);
    if (injectPostSwitchFailure) throw new Error('injected post-switch verification failure');

    const currentTarget = await readlink(activePointer);
    assert(currentTarget === finalDirectory, 'active pointer mismatch');
    const inventoryAfterSwitch = await inventoryTree(finalDirectory);
    assert(canonical(inventoryBeforeSwitch) === canonical(inventoryAfterSwitch), 'runtime changed after activation');

    const evidence = {
      schema: SCHEMA,
      import: { identity: imported.identity, fileSha256: sha256Bytes(importBytes), size: importBytes.length },
      release: {
        name: releaseName,
        id: releaseId,
        runtimeSha256: runtime.sha256,
        runtimeSize: runtime.size,
        inventory: inventoryAfterSwitch,
        inventorySha256: sha256Bytes(Buffer.from(canonical(inventoryAfterSwitch))),
      },
      checks,
      pointer: {
        activeTarget: `releases/${releaseId}`,
        previousTarget: previousTarget ? path.relative(stateDir, previousTarget) : null,
        atomicSwitch: true,
        rollbackAvailable: Boolean(previousTarget),
      },
      policy: {
        immutableReleaseDirectory: true,
        verifyBeforeSwitch: true,
        verifyAfterSwitch: true,
        rollbackOnFailure: true,
        providerAuthority: false,
      },
    };
    evidence.identity = logicalIdentity(evidence);
    await writeFile(output, `${canonical(evidence)}\n`, { flag: 'wx' });
    return evidence;
  } catch (error) {
    if (await exists(activePointer)) {
      try {
        const currentTarget = await readlink(activePointer);
        if (currentTarget === finalDirectory && previousTarget) await atomicPointer(activePointer, previousTarget);
        else if (currentTarget === finalDirectory && !previousTarget) await rm(activePointer);
      } catch {}
    }
    if (await exists(stagingDirectory)) await rm(stagingDirectory, { recursive: true, force: true });
    if (await exists(finalDirectory)) await rm(finalDirectory, { recursive: true, force: true });
    throw error;
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 2) {
    assert(argv[index]?.startsWith('--'), `invalid argument ${argv[index]}`);
    options[argv[index].slice(2)] = argv[index + 1];
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv);
    await activate({
      importFile: path.resolve(args.import),
      runtimeSource: path.resolve(args.runtime),
      stateDir: path.resolve(args.stateDir ?? '.fia/runtime'),
      releaseName: args.releaseName ?? 'preview',
      output: path.resolve(args.output),
      injectPostSwitchFailure: args.injectPostSwitchFailure === 'true',
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
