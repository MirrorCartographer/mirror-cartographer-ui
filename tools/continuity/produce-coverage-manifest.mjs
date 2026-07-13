#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXACT_QUERIES = ['M-004', 'M-005', 'M-006'];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function runGit(repoPath, args) {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

export function buildCoverageManifest({ repositoryFullName, repositoryObjectId, repoPath, git = runGit, queries = EXACT_QUERIES }) {
  const errors = [];
  const raw = {};
  const capture = (key, args) => {
    try {
      raw[key] = git(repoPath, args);
      return raw[key];
    } catch (error) {
      errors.push({ step: key, message: String(error?.stderr || error?.message || error).slice(0, 500) });
      raw[key] = '';
      return '';
    }
  };

  const defaultBranch = capture('default_branch', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '') ||
    capture('current_branch', ['branch', '--show-current']);
  const defaultBranchHeadSha = capture('default_branch_head', ['rev-parse', defaultBranch || 'HEAD']);
  const refs = lines(capture('refs', ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes']));
  const tags = lines(capture('tags', ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/tags']));
  const commits = lines(capture('commits', ['rev-list', '--all']));
  const objects = lines(capture('objects', ['rev-list', '--objects', '--all']));
  const objectIds = objects.map((line) => line.split(' ')[0]).filter(Boolean);
  let typedObjects = [];
  if (objectIds.length) {
    try {
      const output = execFileSync('git', ['-C', repoPath, 'cat-file', '--batch-check=%(objectname) %(objecttype)'], {
        input: objectIds.join('\n') + '\n', encoding: 'utf8', maxBuffer: 128 * 1024 * 1024
      }).trim();
      raw.typed_objects = output;
      typedObjects = lines(output);
    } catch (error) {
      errors.push({ step: 'typed_objects', message: String(error?.stderr || error?.message || error).slice(0, 500) });
      raw.typed_objects = '';
    }
  }

  const matches = [];
  for (const query of queries) {
    const output = capture(`query_${query}`, ['log', '--all', '--format=%H', '-S', query, '--pickaxe-all', '--name-only']);
    matches.push({ query, matching_log_lines: lines(output) });
  }

  const treeCount = typedObjects.filter((line) => line.endsWith(' tree')).length;
  const blobCount = typedObjects.filter((line) => line.endsWith(' blob')).length;
  const rawCanonical = JSON.stringify(stable(raw));
  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    repository_full_name: repositoryFullName,
    repository_object_id: repositoryObjectId,
    default_branch: defaultBranch || null,
    default_branch_head_sha: defaultBranchHeadSha || null,
    refs,
    tags,
    reachable_commit_count: new Set(commits).size,
    tree_count: treeCount,
    blob_count: blobCount,
    queries_utf8: queries.map((query) => ({ query, hex: Buffer.from(query, 'utf8').toString('hex') })),
    namespace_matches: matches,
    excluded_objects: [],
    traversal_errors: errors,
    completion_state: errors.length === 0 ? 'complete' : 'partial',
    raw_output_sha256: sha256(rawCanonical)
  };
  manifest.manifest_sha256 = sha256(JSON.stringify(stable(manifest)));
  return { manifest, raw };
}

function main() {
  const [, , repoArg = '.', outputArg = 'operations/evidence/continuity-coverage-manifest.json', rawArg = 'operations/evidence/continuity-coverage-raw.json'] = process.argv;
  const repoPath = resolve(repoArg);
  if (!existsSync(resolve(repoPath, '.git'))) throw new Error(`Not a Git repository: ${repoPath}`);
  const repositoryFullName = process.env.REPOSITORY_FULL_NAME || runGit(repoPath, ['config', '--get', 'remote.origin.url']).replace(/^.*github.com[:/]/, '').replace(/\.git$/, '');
  const repositoryObjectId = process.env.REPOSITORY_OBJECT_ID || 'unresolved';
  const { manifest, raw } = buildCoverageManifest({ repositoryFullName, repositoryObjectId, repoPath });
  writeFileSync(resolve(outputArg), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(resolve(rawArg), JSON.stringify(raw, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output: outputArg, raw: rawArg, completion_state: manifest.completion_state, manifest_sha256: manifest.manifest_sha256 }) + '\n');
  if (manifest.completion_state !== 'complete') process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
