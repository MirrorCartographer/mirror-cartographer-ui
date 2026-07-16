#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    }
    args.set(key.slice(2), value);
  }
  return {
    input: args.get('input') ?? 'dist',
    outputRoot: args.get('output-root') ?? 'releases',
    commit: args.get('commit') ?? '',
    createdAt: args.get('created-at') ?? new Date().toISOString(),
  };
}

async function walkFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, fullPath));
    else if (entry.isFile()) files.push(path.relative(root, fullPath).split(path.sep).join('/'));
  }
  return files;
}

async function digestFile(filePath) {
  const bytes = await readFile(filePath);
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  };
}

export async function packageStaticRelease({ input, outputRoot, commit, createdAt }) {
  if (!SHA_PATTERN.test(commit)) throw new Error('commit must be a 40-character lowercase hexadecimal SHA');
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('created-at must be a parseable timestamp');

  const inputStat = await stat(input).catch(() => null);
  if (!inputStat?.isDirectory()) throw new Error(`input directory not found: ${input}`);

  const sourceFiles = await walkFiles(input);
  if (sourceFiles.length === 0) throw new Error('refusing to package an empty build');

  const releaseDir = path.join(outputRoot, commit);
  const existing = await stat(releaseDir).catch(() => null);
  if (existing) throw new Error(`immutable release already exists: ${releaseDir}`);

  const stagingDir = path.join(outputRoot, `.staging-${commit}-${process.pid}`);
  await mkdir(outputRoot, { recursive: true });
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });

  try {
    await cp(input, path.join(stagingDir, 'site'), { recursive: true, errorOnExist: true });
    const files = [];
    for (const relativePath of sourceFiles) {
      const metadata = await digestFile(path.join(input, relativePath));
      files.push({ path: relativePath, ...metadata });
    }
    const manifest = {
      schema: 'mirror-cartographer.static-release.v1',
      commit,
      created_at: new Date(createdAt).toISOString(),
      file_count: files.length,
      files,
    };
    const canonicalManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(path.join(stagingDir, 'release-manifest.json'), canonicalManifest, 'utf8');
    await cp(stagingDir, releaseDir, { recursive: true, errorOnExist: true });
    await rm(stagingDir, { recursive: true, force: true });
    return { releaseDir, manifest };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    await rm(releaseDir, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  packageStaticRelease(parseArgs(process.argv.slice(2)))
    .then(({ releaseDir, manifest }) => {
      process.stdout.write(`${JSON.stringify({ ok: true, release_dir: releaseDir, file_count: manifest.file_count })}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
      process.exitCode = 1;
    });
}
