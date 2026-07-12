#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BUILD_RELEVANT_PREFIXES = [
  'src/',
  'public/',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.',
  'vercel.json',
  'scripts/vercel-',
];

export function requiresVercelBuild(paths) {
  return paths.some((path) =>
    BUILD_RELEVANT_PREFIXES.some((prefix) =>
      prefix.endsWith('/') || prefix.endsWith('.')
        ? path.startsWith(prefix)
        : path === prefix,
    ),
  );
}

export function changedPaths() {
  const output = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], {
    encoding: 'utf8',
  });
  return output.split(/\r?\n/u).map((path) => path.trim()).filter(Boolean);
}

export function main() {
  let paths;
  try {
    paths = changedPaths();
  } catch (error) {
    console.error('Unable to determine changed paths; proceeding with deployment.', error.message);
    return 1;
  }

  const buildRequired = requiresVercelBuild(paths);
  console.log(JSON.stringify({ buildRequired, paths }, null, 2));

  // Vercel ignores a deployment when ignoreCommand exits 0.
  return buildRequired ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
