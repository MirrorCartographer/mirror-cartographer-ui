#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function fail(message) {
  const error = new Error(message);
  error.code = 'FIA_ARTIFACT_INVALID';
  throw error;
}

function normalizeRelative(input) {
  if (typeof input !== 'string' || input.length === 0) fail('manifest path must be a non-empty string');
  const normalized = input.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.includes('\0')) fail(`unsafe manifest path: ${input}`);
  const clean = path.posix.normalize(normalized);
  if (clean === '..' || clean.startsWith('../')) fail(`path traversal rejected: ${input}`);
  return clean;
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function walk(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, '/'));
    else fail(`unsupported filesystem entry: ${absolute}`);
  }
  return files;
}

export async function verifyArtifact({ artifactDir, manifestPath, exact = true }) {
  const root = path.resolve(artifactDir);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.schema !== 'fia.artifact-manifest.v1') fail(`unsupported schema: ${manifest.schema}`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail('manifest files must be a non-empty array');

  const expected = new Set();
  const verified = [];
  for (const entry of [...manifest.files].sort((a, b) => String(a.path).localeCompare(String(b.path)))) {
    const relative = normalizeRelative(entry.path);
    if (expected.has(relative)) fail(`duplicate manifest path: ${relative}`);
    expected.add(relative);

    const absolute = path.resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) fail(`path escaped artifact root: ${relative}`);
    const stat = await fs.stat(absolute).catch(() => null);
    if (!stat?.isFile()) fail(`missing artifact file: ${relative}`);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) fail(`invalid size for ${relative}`);
    if (stat.size !== entry.size) fail(`size mismatch for ${relative}: expected ${entry.size}, got ${stat.size}`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) fail(`invalid sha256 for ${relative}`);
    const digest = await sha256(absolute);
    if (digest !== entry.sha256) fail(`sha256 mismatch for ${relative}`);
    verified.push({ path: relative, size: stat.size, sha256: digest });
  }

  if (exact) {
    const actual = await walk(root);
    const extras = actual.filter((file) => !expected.has(file));
    if (extras.length) fail(`unmanifested files present: ${extras.join(', ')}`);
  }

  const aggregate = createHash('sha256')
    .update(JSON.stringify(verified))
    .digest('hex');
  return { ok: true, schema: manifest.schema, files: verified.length, aggregate };
}

async function main() {
  const [artifactDir, manifestPath, flag] = process.argv.slice(2);
  if (!artifactDir || !manifestPath) {
    console.error('usage: node tools/fia/verify-artifact.mjs <artifact-dir> <manifest.json> [--allow-extra]');
    process.exit(64);
  }
  try {
    const result = await verifyArtifact({ artifactDir, manifestPath, exact: flag !== '--allow-extra' });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(`fia verify: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
