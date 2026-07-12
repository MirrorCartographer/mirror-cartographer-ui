#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const FULL_SHA = /^[0-9a-f]{40}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const ALLOWED_FLAGS = new Set(['--base', '--head', '--output']);
const REQUIRED_FLAGS = new Set(['--base', '--head']);

export function buildChangedPathsManifest({ base, head, runGit = execFileSync } = {}) {
  if (!FULL_SHA.test(base || '') || !FULL_SHA.test(head || '')) {
    throw new Error('base and head must be immutable 40-character lowercase commit SHAs');
  }
  if (base === head) throw new Error('base and head must differ');

  const raw = runGit('git', ['diff', '--name-only', '-z', '--diff-filter=ACMRTUXB', `${base}..${head}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const changedPaths = [...new Set(String(raw)
    .split('\0')
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

  if (changedPaths.length === 0) throw new Error('immutable comparison produced no changed paths');
  if (changedPaths.some((value) =>
    value.startsWith('/') ||
    value.includes('..') ||
    value.includes('\\') ||
    CONTROL_CHARACTER.test(value)
  )) {
    throw new Error('git diff returned an unsafe repository path');
  }

  return {
    schema_version: 1,
    comparison: { base, head, range: `${base}..${head}` },
    changed_paths: changedPaths,
    path_count: changedPaths.length,
    path_encoding: 'nul-delimited'
  };
}

export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.length % 2 !== 0) {
    throw new Error('arguments must be non-empty flag/value pairs');
  }

  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!ALLOWED_FLAGS.has(flag)) throw new Error(`unknown argument: ${flag}`);
    if (args.has(flag)) throw new Error(`duplicate argument: ${flag}`);
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
      throw new Error(`missing value for argument: ${flag}`);
    }
    args.set(flag, value);
  }

  for (const flag of REQUIRED_FLAGS) {
    if (!args.has(flag)) throw new Error(`missing required argument: ${flag}`);
  }
  return args;
}

export function resolveOutputPath(cwd, requested = 'operations/changed-paths.json') {
  if (typeof cwd !== 'string' || cwd.length === 0) throw new Error('cwd must be a non-empty path');
  if (typeof requested !== 'string' || requested.length === 0 || CONTROL_CHARACTER.test(requested)) {
    throw new Error('output must be a non-empty control-character-free path');
  }

  const root = path.resolve(cwd);
  const operationsRoot = path.join(root, 'operations');
  const output = path.resolve(root, requested);
  const relative = path.relative(operationsRoot, output);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('output must resolve to a file inside operations/');
  }
  if (path.extname(output).toLowerCase() !== '.json') {
    throw new Error('output must use a .json extension');
  }
  return output;
}

export function runChangedPathsCli({ argv = process.argv.slice(2), cwd = process.cwd(), runGit = execFileSync } = {}) {
  try {
    const args = parseArgs(argv);
    const manifest = buildChangedPathsManifest({
      base: args.get('--base'),
      head: args.get('--head'),
      runGit
    });
    const output = resolveOutputPath(cwd, args.get('--output'));
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
    process.stdout.write(`${JSON.stringify({ schema_version: 1, stage: 'changed_paths', output, path_count: manifest.path_count, comparison: manifest.comparison })}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ schema_version: 1, stage: 'changed_paths', written: false, reason: 'input_or_git_error', error: error.message })}\n`);
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = runChangedPathsCli();