#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONFIG_SCHEMA = 'fia.runtime-route-config.v1';
const OUTPUT_SCHEMA = 'fia.runtime-route-manifest.v1';
const DENIED_PROVIDER_TOKENS = ['vercel', 'cloudflare', 'github.io'];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertExactKeys(obj, keys, label) {
  const actual = Object.keys(obj).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    throw new Error(`${label} must contain exactly: ${expected.join(', ')}`);
  }
}

function normalizeRoute(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) throw new Error(`invalid route: ${route}`);
  if (route.includes('\\') || route.includes('?') || route.includes('#')) throw new Error(`unsafe route: ${route}`);
  const decoded = decodeURIComponent(route);
  if (decoded.split('/').includes('..')) throw new Error(`route traversal: ${route}`);
  const normalized = path.posix.normalize(route);
  if (!normalized.startsWith('/')) throw new Error(`invalid normalized route: ${route}`);
  return normalized !== '/' && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function normalizeRelativeFile(file) {
  if (typeof file !== 'string' || file.length === 0 || path.posix.isAbsolute(file) || file.includes('\\')) {
    throw new Error(`invalid relative file: ${file}`);
  }
  const normalized = path.posix.normalize(file);
  if (normalized === '..' || normalized.startsWith('../')) throw new Error(`file escapes root: ${file}`);
  return normalized;
}

async function inventory(root) {
  const files = [];
  async function walk(relative = '') {
    const absolute = path.join(root, relative);
    const entries = await readdir(absolute, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const rel = path.posix.join(relative.split(path.sep).join('/'), entry.name);
      const abs = path.join(root, rel);
      const stat = await lstat(abs);
      if (stat.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (stat.isDirectory()) await walk(rel);
      else if (stat.isFile()) {
        const bytes = await readFile(abs);
        files.push({ path: rel, size: bytes.length, sha256: sha256(bytes), mode: stat.mode & 0o777 });
      } else throw new Error(`unsupported filesystem entry: ${rel}`);
    }
  }
  await walk();
  return files;
}

function validateHtml(html, file) {
  const lower = html.toLowerCase();
  if (!/<html\b[^>]*\blang\s*=/.test(lower)) throw new Error(`${file} missing html lang`);
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/.test(lower)) throw new Error(`${file} missing viewport meta`);
  if (/\bautoplay\b/.test(lower)) throw new Error(`${file} contains autoplay`);
  for (const token of DENIED_PROVIDER_TOKENS) {
    if (lower.includes(token)) throw new Error(`${file} contains provider coupling: ${token}`);
  }
}

export async function compileRuntimeRouteManifest({ configPath, rootDir, outputPath }) {
  const configBytes = await readFile(configPath);
  const config = JSON.parse(configBytes.toString('utf8'));
  assertExactKeys(config, ['schema', 'routes', 'offlineFallback'], 'config');
  if (config.schema !== CONFIG_SCHEMA) throw new Error(`unsupported config schema: ${config.schema}`);
  if (!Array.isArray(config.routes) || config.routes.length === 0) throw new Error('routes must be a non-empty array');

  const fullInventory = await inventory(rootDir);
  const byPath = new Map(fullInventory.map((item) => [item.path, item]));
  const seenRoutes = new Set();
  const routes = [];

  for (const item of config.routes) {
    assertExactKeys(item, ['route', 'document', 'assets'], 'route entry');
    const route = normalizeRoute(item.route);
    if (seenRoutes.has(route)) throw new Error(`duplicate route: ${route}`);
    seenRoutes.add(route);
    const document = normalizeRelativeFile(item.document);
    if (!byPath.has(document)) throw new Error(`missing route document: ${document}`);
    if (!document.endsWith('.html')) throw new Error(`route document must be HTML: ${document}`);
    if (!Array.isArray(item.assets)) throw new Error(`assets must be an array for ${route}`);
    const assets = [...new Set(item.assets.map(normalizeRelativeFile))].sort();
    if (assets.length !== item.assets.length) throw new Error(`duplicate assets for ${route}`);
    for (const asset of assets) {
      if (!byPath.has(asset)) throw new Error(`missing declared asset: ${asset}`);
      if (asset.endsWith('.html')) throw new Error(`HTML cannot be declared as asset: ${asset}`);
    }
    validateHtml((await readFile(path.join(rootDir, document))).toString('utf8'), document);
    routes.push({
      route,
      document: byPath.get(document),
      assets: assets.map((asset) => byPath.get(asset)),
    });
  }

  routes.sort((a, b) => a.route.localeCompare(b.route, 'en'));
  const offlineFallback = normalizeRelativeFile(config.offlineFallback);
  if (!byPath.has(offlineFallback)) throw new Error(`missing offline fallback: ${offlineFallback}`);
  if (!offlineFallback.endsWith('.html')) throw new Error('offlineFallback must be HTML');
  validateHtml((await readFile(path.join(rootDir, offlineFallback))).toString('utf8'), offlineFallback);

  const referenced = new Set([offlineFallback]);
  for (const route of routes) {
    referenced.add(route.document.path);
    for (const asset of route.assets) referenced.add(asset.path);
  }
  const unreferenced = fullInventory.filter((item) => !referenced.has(item.path)).map((item) => item.path);
  if (unreferenced.length) throw new Error(`unreferenced runtime files: ${unreferenced.join(', ')}`);

  const identityMaterial = {
    schema: OUTPUT_SCHEMA,
    configSha256: sha256(configBytes),
    routes,
    offlineFallback: byPath.get(offlineFallback),
    policy: {
      exactConfigSchema: true,
      rejectSymlinks: true,
      rejectUnreferencedFiles: true,
      requireHtmlLang: true,
      requireViewport: true,
      rejectAutoplay: true,
      deniedProviderTokens: DENIED_PROVIDER_TOKENS,
    },
  };
  const result = { ...identityMaterial, identity: sha256(Buffer.from(canonical(identityMaterial))) };
  await writeFile(outputPath, `${canonical(result)}\n`, { flag: 'wx', mode: 0o644 });
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv);
  if (!args['--config'] || !args['--root'] || !args['--output']) {
    console.error('usage: compile-runtime-route-manifest.mjs --config <file> --root <dir> --output <file>');
    process.exit(2);
  }
  compileRuntimeRouteManifest({ configPath: args['--config'], rootDir: args['--root'], outputPath: args['--output'] })
    .then((result) => process.stdout.write(`${result.identity}\n`))
    .catch((error) => { console.error(error.message); process.exit(1); });
}
