#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REPOSITORY = 'MirrorCartographer/mirror-cartographer-ui';
const REQUIRED_SOURCE_CLASSES = [
  'decision_log',
  'language_lexicon',
  'project_document',
  'chat_history_reference',
  'repository_artifact',
];

function fail(message) {
  throw new Error(`CM-1033 collection failed: ${message}`);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) fail('arguments must be --key value pairs');
    result[key.slice(2)] = value;
  }
  for (const key of ['artifact-search', 'output']) {
    if (!result[key]) fail(`--${key} is required`);
  }
  return result;
}

function ghJson(args) {
  const output = execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function assertArtifactSearch(search) {
  if (search?.search_complete !== true) fail('artifact search must be explicitly complete');
  if (!Array.isArray(search.source_classes_searched)) fail('artifact search source classes are missing');
  for (const sourceClass of REQUIRED_SOURCE_CLASSES) {
    if (!search.source_classes_searched.includes(sourceClass)) {
      fail(`artifact search omitted source class ${sourceClass}`);
    }
  }
  for (const identifier of ['M-004', 'M-005', 'M-006']) {
    if (!search.results?.[identifier]) fail(`artifact search omitted ${identifier}`);
  }
}

function collectBranches(retrievedAt) {
  const branches = ghJson([
    'api',
    '--paginate',
    '--slurp',
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28',
    `/repos/${REPOSITORY}/branches?per_page=100`,
  ]).flat();
  if (branches.length === 0) fail('branch inventory is empty');
  return branches.map((branch) => ({
    branch_name: branch.name,
    head_commit_sha: branch.commit.sha,
    retrieved_at: retrievedAt,
    retrieval_method: 'gh api --paginate --slurp branches per_page=100',
  }));
}

function collectCommits(branches, retrievedAt) {
  const commits = [];
  for (const branch of branches) {
    const pages = ghJson([
      'api',
      '--paginate',
      '--slurp',
      '-H', 'Accept: application/vnd.github+json',
      '-H', 'X-GitHub-Api-Version: 2022-11-28',
      `/repos/${REPOSITORY}/commits?sha=${encodeURIComponent(branch.branch_name)}&per_page=100`,
    ]);
    const records = pages.flat();
    if (records.length === 0) fail(`commit traversal is empty for branch ${branch.branch_name}`);
    for (const commit of records) {
      commits.push({
        branch_name: branch.branch_name,
        commit_sha: commit.sha,
        parent_shas: commit.parents.map((parent) => parent.sha),
        committed_at: commit.commit.committer.date,
        message: commit.commit.message,
        retrieved_at: retrievedAt,
      });
    }
    if (!records.some((commit) => commit.parents.length === 0)) {
      fail(`provider traversal did not reach a root for branch ${branch.branch_name}`);
    }
  }
  return commits;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactSearch = JSON.parse(readFileSync(args['artifact-search'], 'utf8'));
  assertArtifactSearch(artifactSearch);

  const retrievedAt = new Date().toISOString();
  const branches = collectBranches(retrievedAt);
  const commits = collectCommits(branches, retrievedAt);

  const envelope = {
    schema_version: 1,
    contract_id: 'CM-1031',
    queue_item: 'M-RECONCILE-002',
    repository: REPOSITORY,
    collected_at: retrievedAt,
    branch_inventory: {
      complete: true,
      pagination_exhausted: true,
      branches,
    },
    commit_history: {
      complete: true,
      provider_boundary: null,
      commits,
    },
    artifact_search: artifactSearch,
    collection_constraints: {
      credentials_persisted: false,
      destructive_operations: false,
      history_rewritten: false,
    },
  };

  writeFileSync(args.output, `${JSON.stringify(envelope, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${args.output}\n`);
}

main();
