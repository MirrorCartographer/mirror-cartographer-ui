#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEPLOYMENT_IRRELEVANT_PREFIXES = [
  'operations/',
  'foundation-os/',
  'tools/conversation_parallax/runs/',
  '.github/workflows/',
];

const DEPLOYMENT_IRRELEVANT_FILES = new Set([
  'README.md',
  'PREVIEWS.md',
  'scripts/vercel-ignore-build.mjs',
]);

export function isDeploymentIrrelevantPath(path) {
  return DEPLOYMENT_IRRELEVANT_FILES.has(path)
    || DEPLOYMENT_IRRELEVANT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function requiresVercelBuild(paths) {
  // Suppress a deployment only when the commit has at least one changed path
  // and every changed path is explicitly classified as deployment-irrelevant.
  // Unknown paths fail closed and therefore receive a Vercel build.
  return paths.length === 0 || paths.some((path) => !isDeploymentIrrelevantPath(path));
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
