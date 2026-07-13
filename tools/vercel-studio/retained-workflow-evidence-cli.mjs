#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildWorkflowEvidenceBundleFromGhPages } from './gh-envelope-bundle-adapter.mjs';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments_must_be_flag_value_pairs');
    values.set(key.slice(2), value);
  }
  return values;
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
      retrieved_at: primaryRetrievedAt,
      pages_fetched: primary.pagesFetched ?? null
    },
    ghPages,
    ghCommand,
    ghRetrievedAt,
    generatedAt
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
