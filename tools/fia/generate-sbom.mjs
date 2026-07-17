#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'fia.cyclonedx-sbom.v1';

function fail(message) {
  throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseIntegrity(integrity, path) {
  if (typeof integrity !== 'string' || integrity.trim() === '') fail(`Missing integrity for ${path}`);
  const hashes = integrity.trim().split(/\s+/).map((token) => {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(token);
    if (!match) fail(`Unsupported integrity token for ${path}: ${token}`);
    return { alg: match[1].toUpperCase().replace('SHA', 'SHA-'), content: match[2] };
  });
  return hashes.sort((a, b) => `${a.alg}:${a.content}`.localeCompare(`${b.alg}:${b.content}`));
}

function packageNameFromPath(path) {
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  if (index < 0) return null;
  const rest = path.slice(index + marker.length);
  const parts = rest.split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1] || ''}` : parts[0];
}

function purl(name, version, path = '') {
  const encodedName = name.startsWith('@')
    ? `${encodeURIComponent(name.split('/')[0])}/${encodeURIComponent(name.split('/')[1])}`
    : encodeURIComponent(name);
  const base = `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
  return path ? `${base}?fia_path=${encodeURIComponent(path)}` : base;
}

export function generateSbom(lockfile, options = {}) {
  if (!lockfile || typeof lockfile !== 'object' || Array.isArray(lockfile)) fail('Lockfile must be a JSON object');
  if (![2, 3].includes(lockfile.lockfileVersion)) fail(`Unsupported lockfileVersion: ${lockfile.lockfileVersion}`);
  if (!lockfile.packages || typeof lockfile.packages !== 'object' || Array.isArray(lockfile.packages)) fail('Lockfile packages graph is required');

  const root = lockfile.packages[''] || {};
  const applicationName = options.applicationName || root.name || lockfile.name;
  const applicationVersion = options.applicationVersion || root.version || lockfile.version;
  if (!applicationName || !applicationVersion) fail('Application name and version are required');

  const components = [];
  for (const path of Object.keys(lockfile.packages).filter(Boolean).sort()) {
    const entry = lockfile.packages[path];
    if (!entry || typeof entry !== 'object') fail(`Invalid package entry at ${path}`);
    const name = entry.name || packageNameFromPath(path);
    const version = entry.version;
    if (!name || !version) fail(`Package name and version are required at ${path}`);
    if (!entry.resolved) fail(`Missing resolved source for ${path}`);
    const hashes = parseIntegrity(entry.integrity, path);
    const bomRef = purl(name, version, path);
    components.push({
      type: 'library',
      'bom-ref': bomRef,
      name,
      version,
      purl: bomRef,
      hashes,
      externalReferences: [{ type: 'distribution', url: entry.resolved }],
      properties: [
        { name: 'fia:lockfile-path', value: path },
        { name: 'fia:dev', value: String(Boolean(entry.dev)) },
        { name: 'fia:optional', value: String(Boolean(entry.optional)) }
      ]
    });
  }

  components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']) || a.properties[0].value.localeCompare(b.properties[0].value));
  const rootRef = purl(applicationName, applicationVersion);
  const directNames = new Set([
    ...Object.keys(root.dependencies || {}),
    ...Object.keys(root.devDependencies || {}),
    ...Object.keys(root.optionalDependencies || {})
  ]);
  const rootDependsOn = components
    .filter((component) => directNames.has(component.name))
    .map((component) => component['bom-ref'])
    .sort();

  const componentDigest = sha256(canonical(components));
  const applicationDigest = sha256(canonical({ applicationName, applicationVersion, components }));
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${applicationDigest.slice(0, 8)}-${componentDigest.slice(8, 12)}-5${componentDigest.slice(13, 16)}-a${componentDigest.slice(17, 20)}-${componentDigest.slice(20, 32)}`,
    version: 1,
    metadata: {
      component: { type: 'application', 'bom-ref': rootRef, name: applicationName, version: applicationVersion, purl: rootRef },
      properties: [
        { name: 'fia:schema', value: SCHEMA },
        { name: 'fia:lockfile-sha256', value: sha256(canonical(lockfile)) }
      ]
    },
    components,
    dependencies: [{ ref: rootRef, dependsOn: rootDependsOn }]
  };

  const canonicalSbom = canonical(sbom);
  return { sbom, canonical: canonicalSbom, identity: `sha256:${sha256(canonicalSbom)}` };
}

function parseArgs(argv) {
  const args = { lockfile: 'package-lock.json', output: 'artifacts/sbom.cdx.json' };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--lockfile') args.lockfile = argv[++i];
    else if (token === '--output') args.output = argv[++i];
    else if (token === '--name') args.applicationName = argv[++i];
    else if (token === '--version') args.applicationVersion = argv[++i];
    else fail(`Unknown argument: ${token}`);
  }
  if (!args.lockfile || !args.output) fail('Both --lockfile and --output require values');
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const lockfile = JSON.parse(readFileSync(resolve(args.lockfile), 'utf8'));
  const result = generateSbom(lockfile, args);
  mkdirSync(resolve(args.output, '..'), { recursive: true });
  writeFileSync(resolve(args.output), `${JSON.stringify(result.sbom, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ schema: SCHEMA, output: resolve(args.output), identity: result.identity, components: result.sbom.components.length })}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
