#!/usr/bin/env node
import { constants } from 'node:fs';
import { open, writeFile } from 'node:fs/promises';
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

async function openRetainedRegularFile(path, label) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new Error(`${label}_symlink_rejected`);
    throw new Error(`${label}_open_failed:${error.code || error.message}`);
  }

  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`${label}_not_regular_file`);
    return { handle, identity: `${stats.dev}:${stats.ino}` };
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

async function openRetainedSources({ primaryPath, ghPagesPath, ghCommandPath, rateLimitProofPath }) {
  const entries = [
    ['primary', primaryPath],
    ['gh_pages', ghPagesPath],
    ['gh_command', ghCommandPath],
    ['rate_limit_proof', rateLimitProofPath]
  ];
  const opened = [];
  try {
    for (const [label, path] of entries) opened.push([label, await openRetainedRegularFile(path, label)]);
    const identities = opened.map(([, source]) => source.identity);
    if (new Set(identities).size !== identities.length) throw new Error('retained_source_files_not_distinct');
    return new Map(opened);
  } catch (error) {
    await Promise.all(opened.map(([, source]) => source.handle.close().catch(() => {})));
    throw error;
  }
}

async function readJsonHandle(handle, label) {
  let text;
  try { text = await handle.readFile('utf8'); }
  catch (error) { throw new Error(`${label}_read_failed:${error.code || error.message}`); }
  try { return JSON.parse(text); }
  catch { throw new Error(`${label}_json_invalid`); }
}

export async function buildRetainedWorkflowEvidence({
  commitSha,
  primaryPath,
  ghPagesPath,
  ghCommandPath,
  rateLimitProofPath,
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

  const sources = await openRetainedSources({ primaryPath, ghPagesPath, ghCommandPath, rateLimitProofPath });
  try {
    const [primary, ghPages, ghCommandText, rateLimitProof] = await Promise.all([
      readJsonHandle(sources.get('primary').handle, 'primary'),
      readJsonHandle(sources.get('gh_pages').handle, 'gh_pages'),
      sources.get('gh_command').handle.readFile('utf8').catch(error => { throw new Error(`gh_command_read_failed:${error.code || error.message}`); }),
      readJsonHandle(sources.get('rate_limit_proof').handle, 'rate_limit_proof')
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
      rateLimitProof,
      generatedAt: validatedGeneratedAt
    });
  } finally {
    await Promise.all([...sources.values()].map(source => source.handle.close().catch(() => {})));
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const required = ['commit', 'primary', 'gh-pages', 'gh-command', 'rate-limit-proof', 'primary-retrieved-at', 'gh-retrieved-at', 'output'];
  for (const key of required) if (!args.get(key)) throw new Error(`missing_argument:${key}`);

  const bundle = await buildRetainedWorkflowEvidence({
    commitSha: args.get('commit'),
    primaryPath: args.get('primary'),
    ghPagesPath: args.get('gh-pages'),
    ghCommandPath: args.get('gh-command'),
    rateLimitProofPath: args.get('rate-limit-proof'),
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
