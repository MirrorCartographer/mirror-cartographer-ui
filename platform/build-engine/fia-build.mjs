#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const RELEASE_SCHEMA = 'foundation.build.release.v1';
const POLICY = Object.freeze({
  providerNeutral: true,
  rejectSymlinks: true,
  rejectCaseFoldCollisions: true,
  requireRootRoute: true,
  requireHtmlLang: true,
  requireTitle: true,
  requireViewport: true,
  requireImageAlt: true,
  rejectAutoplay: true,
  atomicPublication: true,
});

function sha256(data) {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function safeRelative(relativePath) {
  const normalized = relativePath.normalize('NFC').replaceAll(path.sep, '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))
  ) {
    throw new Error(`unsafe path: ${relativePath}`);
  }
  return normalized;
}

async function inventory(root) {
  const files = [];
  const foldedPaths = new Set();

  async function visit(directory) {
    const entries = (await fs.readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = safeRelative(path.relative(root, absolute));
      const folded = relative.toLocaleLowerCase('en-US');
      if (foldedPaths.has(folded)) throw new Error(`case-fold collision: ${relative}`);
      foldedPaths.add(folded);

      if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${relative}`);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) throw new Error(`unsupported filesystem object: ${relative}`);
      files.push({ path: relative, bytes: await fs.readFile(absolute) });
    }
  }

  await visit(root);
  return files;
}

function mediaType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
  })[extension] ?? 'application/octet-stream';
}

function routeFor(filePath) {
  if (filePath === 'index.html') return '/';
  if (filePath.endsWith('/index.html')) return `/${filePath.slice(0, -11)}`;
  if (filePath.endsWith('.html')) return `/${filePath.slice(0, -5)}`;
  return null;
}

function validateHtml(filePath, html) {
  const failures = [];
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) failures.push('missing html lang');
  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) failures.push('missing title');
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i.test(html)) failures.push('missing viewport');
  if (/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(html)) failures.push('autoplay forbidden');
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(tag)) failures.push('image missing alt');
  }
  if (failures.length) throw new Error(`${filePath}: ${[...new Set(failures)].join(', ')}`);
}

async function fsyncFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function fsyncDirectory(directory) {
  const handle = await fs.open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeCanonical(filePath, value) {
  await fs.writeFile(filePath, `${canonical(value)}\n`, { flag: 'wx', mode: 0o444 });
  await fsyncFile(filePath);
}

export async function build({ input, output, sourceIdentity = 'unversioned' }) {
  const inputRoot = path.resolve(input);
  const outputRoot = path.resolve(output);
  const inputStat = await fs.stat(inputRoot);
  if (!inputStat.isDirectory()) throw new Error(`input is not a directory: ${inputRoot}`);
  try {
    await fs.access(outputRoot);
    throw new Error(`output exists: ${outputRoot}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const sourceFiles = await inventory(inputRoot);
  if (!sourceFiles.length) throw new Error('input is empty');
  const stagingRoot = `${outputRoot}.staging-${process.pid}`;
  await fs.rm(stagingRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(stagingRoot, 'objects', 'sha256'), { recursive: true });

  try {
    const manifestFiles = [];
    const routes = [];

    for (const sourceFile of sourceFiles) {
      if (sourceFile.path.endsWith('.html')) validateHtml(sourceFile.path, sourceFile.bytes.toString('utf8'));
      const digest = sha256(sourceFile.bytes);
      const objectPath = path.join(stagingRoot, 'objects', 'sha256', digest.slice(7));
      try {
        await fs.writeFile(objectPath, sourceFile.bytes, { flag: 'wx', mode: 0o444 });
        await fsyncFile(objectPath);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const existing = await fs.readFile(objectPath);
        if (sha256(existing) !== digest || existing.length !== sourceFile.bytes.length) {
          throw new Error(`content-addressed object mismatch: ${digest}`);
        }
      }
      manifestFiles.push({
        path: sourceFile.path,
        sha256: digest,
        size: sourceFile.bytes.length,
        mediaType: mediaType(sourceFile.path),
      });
      const route = routeFor(sourceFile.path);
      if (route) routes.push({ route, file: sourceFile.path });
    }

    manifestFiles.sort((left, right) => left.path.localeCompare(right.path, 'en'));
    routes.sort((left, right) => left.route.localeCompare(right.route, 'en'));
    if (!routes.some(({ route }) => route === '/')) throw new Error('missing root route index.html');

    const authority = { schema: RELEASE_SCHEMA, sourceIdentity, files: manifestFiles, routes, policy: POLICY };
    const releaseIdentity = sha256(Buffer.from(canonical(authority)));
    const manifest = { ...authority, releaseIdentity };
    const documents = {
      'manifest.json': manifest,
      'routes.json': { schema: 'foundation.build.routes.v1', releaseIdentity, routes },
      'sbom.json': {
        schema: 'foundation.build.sbom.v1',
        releaseIdentity,
        components: manifestFiles.map((file) => ({ name: file.path, hashes: [file.sha256], size: file.size, mediaType: file.mediaType })),
      },
      'provenance.json': { schema: 'foundation.build.provenance.v1', releaseIdentity, sourceIdentity, builder: 'fia-build', policy: POLICY },
      'rollback.json': {
        schema: 'foundation.build.rollback.v1',
        releaseIdentity,
        restore: { kind: 'content-addressed-release', manifest: 'manifest.json' },
      },
    };

    for (const [name, document] of Object.entries(documents)) await writeCanonical(path.join(stagingRoot, name), document);
    await fsyncDirectory(path.join(stagingRoot, 'objects', 'sha256'));
    await fsyncDirectory(path.join(stagingRoot, 'objects'));
    await fsyncDirectory(stagingRoot);
    await fs.rename(stagingRoot, outputRoot);
    await fsyncDirectory(path.dirname(outputRoot));
    return manifest;
  } catch (error) {
    await fs.rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function cli() {
  const args = process.argv.slice(2);
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const input = value('--input');
  const output = value('--output');
  const sourceIdentity = value('--sourceIdentity') ?? 'unversioned';
  if (!input || !output) throw new Error('usage: fia-build --input <dir> --output <dir> [--sourceIdentity <id>]');
  const result = await build({ input, output, sourceIdentity });
  process.stdout.write(`${result.releaseIdentity}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
