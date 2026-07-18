#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const SCHEMA = 'fia.dependency-authority.v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function identity(record) {
  return sha256(JSON.stringify(stable(record)));
}
function fail(message) {
  throw new Error(message);
}
function parseArgs(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) fail(`unexpected argument: ${key}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`missing value for ${key}`);
    out[key.slice(2)] = value;
  }
  return out;
}
function packageNameFromPath(packagePath) {
  if (!packagePath.startsWith('node_modules/')) return null;
  const parts = packagePath.split('/node_modules/').at(-1).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}
function declaredDependencies(pkg) {
  const groups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const map = new Map();
  for (const group of groups) {
    for (const [name, requested] of Object.entries(pkg[group] || {})) {
      const existing = map.get(name);
      if (existing && existing.requested !== requested) fail(`conflicting declared ranges for ${name}`);
      map.set(name, { name, requested, scopes: [...(existing?.scopes || []), group].sort() });
    }
  }
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}
export function compileDependencyAuthority(packageBytes, lockBytes) {
  let pkg;
  let lock;
  try {
    pkg = JSON.parse(packageBytes);
  } catch {
    fail('invalid package.json');
  }
  try {
    lock = JSON.parse(lockBytes);
  } catch {
    fail('invalid package-lock.json');
  }
  if (![2, 3].includes(lock.lockfileVersion)) fail('package-lock lockfileVersion must be 2 or 3');
  if (!lock.packages || typeof lock.packages !== 'object') fail('package-lock packages graph is required');
  const root = lock.packages[''];
  if (!root) fail('package-lock root package record is required');
  if (pkg.name !== root.name || pkg.version !== root.version) fail('package.json and lockfile root identity mismatch');
  const declared = declaredDependencies(pkg);
  const rootDeclared = declaredDependencies(root);
  if (JSON.stringify(declared) !== JSON.stringify(rootDeclared)) fail('package.json dependency declarations differ from lockfile root');
  const components = [];
  for (const packagePath of Object.keys(lock.packages).sort()) {
    if (packagePath === '') continue;
    const record = lock.packages[packagePath];
    const name = record.name || packageNameFromPath(packagePath);
    if (!name || !record.version) fail(`dependency record missing name/version: ${packagePath}`);
    if (!record.integrity || !/^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(record.integrity)) fail(`dependency missing supported integrity: ${packagePath}`);
    if (!record.resolved || !/^https:\/\//.test(record.resolved)) fail(`dependency missing immutable https resolved URL: ${packagePath}`);
    if (/https:\/\/[^/]*@/.test(record.resolved)) fail(`resolved URL embeds credentials: ${packagePath}`);
    if (record.hasInstallScript === true) fail(`lifecycle-script dependency rejected: ${packagePath}`);
    components.push({
      path: packagePath,
      name,
      version: record.version,
      integrity: record.integrity,
      resolved: record.resolved,
      dev: record.dev === true,
      optional: record.optional === true,
      peer: record.peer === true
    });
  }
  const base = {
    schema: SCHEMA,
    packageJsonSha256: sha256(packageBytes),
    packageLockSha256: sha256(lockBytes),
    lockfileVersion: lock.lockfileVersion,
    root: { name: pkg.name, version: pkg.version },
    declared,
    components,
    policy: {
      exactLockGraphRequired: true,
      cryptographicIntegrityRequired: true,
      httpsResolvedRequired: true,
      embeddedCredentialsForbidden: true,
      lifecycleScriptsForbidden: true
    }
  };
  return { ...base, identity: identity(base) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv);
    if (!args.package || !args.lockfile || !args.output) fail('required: --package --lockfile --output');
    const [packageBytes, lockBytes] = await Promise.all([readFile(args.package), readFile(args.lockfile)]);
    const record = compileDependencyAuthority(packageBytes, lockBytes);
    await writeFile(args.output, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`${record.identity}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
