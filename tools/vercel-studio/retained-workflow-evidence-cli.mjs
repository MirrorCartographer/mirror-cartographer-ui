#!/usr/bin/env node
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildWorkflowEvidenceBundleFromGhPages } from './gh-envelope-bundle-adapter.mjs';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments_must_be_flag_value_pairs');
    const name = key.slice(2);
    if (values.has(name)) throw new TypeError(`duplicate_argument:${name}`);
    values.set(name, value);
  }
  return values;
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError(`${label}_timestamp_invalid`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw new TypeError(`${label}_timestamp_invalid`);
  }
  return value;
}

async function requireRetainedRegularFile(path, label) {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    throw new Error(`${label}_read_failed:${error.code || error.message}`);
  }
  if (stats.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
  if (!stats.isFile()) throw new Error(`${label}_not_regular_file`);
  return realpath(path).catch(error => {
    throw new Error(`${label}_realpath_failed:${error.code || error.message}`);
  });
}

async function validateRetainedSources({ primaryPath, ghPagesPath, ghCommandPath }) {
  const entries = [
    ['primary', primaryPath],
    ['gh_pages', ghPagesPath],
    ['gh_command', ghCommandPath]
  ];
  const resolved = await Promise.all(entries.map(([label, path]) => requireRetainedRegularFile(path, label)));
  if (new Set(resolved).size !== resolved.length) throw new Error('retained_source_paths_not_distinct');
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label}_read_failed:${error.code || error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}_json_invalid`);
  }
}

export async function buildRetainedWorkflowEvidence({
  commitSha,
  primaryPath,
  ghPagesPath,
  ghCommandPath,
  primaryRetrievedAt,
  ghRetrievedAt,
  generatedAt = new Date().toISOString()
}) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) throw new TypeError('invalid_commit_sha');
  const validatedPrimaryRetrievedAt = requireIsoTimestamp(primaryRetrievedAt, 'primary_retrieved_at');
  const validatedGhRetrievedAt = requireIsoTimestamp(ghRetrievedAt, 'gh_retrieved_at');
  const validatedGeneratedAt = requireIsoTimestamp(generatedAt, 'generated_at');
  if (Date.parse(validatedGeneratedAt) < Date.parse(validatedPrimaryRetrievedAt) || Date.parse(validatedGeneratedAt) < Date.parse(validatedGhRetrievedAt)) {
    throw new TypeError('generated_at_precedes_source_retrieval');
  }

  await validateRetainedSources({ primaryPath, ghPagesPath, ghCommandPath });
  const [primary, ghPages, ghCommandText] = await Promise.all([
    readJson(primaryPath, 'primary'),
    readJson(ghPagesPath, 'gh_pages'),
    readFile(ghCommandPath, 'utf8').catch(error => {
      throw new Error(`gh_command_read_failed:${error.code || error.message}`);
    })
  ]);
  const ghCommand = ghCommandText.trim();
  if (!ghCommand) throw new Error('gh_command_empty');

  return buildWorkflowEvidenceBundleFromGhPages({
    commitSha,
    primary,
    primarySource: {
      method: 'repository_api_link_pagination',
      retrieved_at: validatedPrimaryRetrievedAt,
      pages_fetched: primary.pagesFetched ?? null
    },
    ghPages,
    ghCommand,
    ghRetrievedAt: validatedGhRetrievedAt,
    generatedAt: validatedGeneratedAt
  });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const required = ['commit', 'primary', 'gh-pages', 'gh-command', 'primary-retrieved-at', 'gh-retrieved-at', 'output'];
  for (const key of required) if (!args.get(key)) throw new Error(`missing_argument:${key}`);

  const bundle = await buildRetainedWorkflowEvidence({
    commitSha: args.get('commit'),
    primaryPath: args.get('primary'),
    ghPagesPath: args.get('gh-pages'),
    ghCommandPath: args.get('gh-command'),
    primaryRetrievedAt: args.get('primary-retrieved-at'),
    ghRetrievedAt: args.get('gh-retrieved-at'),
    generatedAt: args.get('generated-at') || new Date().toISOString()
  });

  await writeFile(args.get('output'), `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx' });
  if (bundle.verified !== true) process.exitCode = 2;
  return bundle;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
