#!/usr/bin/env node

const SHA40 = /^[0-9a-f]{40}$/;

export function classifyReportedObject({ report, observed }) {
  const failures = [];

  if (!report || typeof report !== 'object') failures.push('report_missing');
  if (!observed || typeof observed !== 'object') failures.push('observation_missing');

  const commit = report?.commit_sha;
  if (!SHA40.test(commit ?? '')) failures.push('invalid_reported_commit_sha');
  if (!report?.repository) failures.push('reported_repository_missing');
  if (!report?.path) failures.push('reported_path_missing');

  if (observed?.repository !== report?.repository) failures.push('repository_mismatch');
  if (observed?.commit_status !== 'found') failures.push('commit_not_found');
  if (observed?.path_status !== 'found') failures.push('path_not_found');
  if (observed?.commit_sha && observed.commit_sha !== commit) failures.push('observed_commit_mismatch');
  if (observed?.path && observed.path !== report?.path) failures.push('observed_path_mismatch');

  const verified = failures.length === 0;
  return {
    schema_version: 1,
    verified,
    classification: verified ? 'reported_object_verified' : 'reported_object_unverified',
    failures,
    report: {
      repository: report?.repository ?? null,
      commit_sha: commit ?? null,
      path: report?.path ?? null
    },
    observation: {
      repository: observed?.repository ?? null,
      commit_sha: observed?.commit_sha ?? null,
      commit_status: observed?.commit_status ?? 'unknown',
      path: observed?.path ?? null,
      path_status: observed?.path_status ?? 'unknown',
      observed_at: observed?.observed_at ?? null,
      source: observed?.source ?? null
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  process.stdout.write(`${JSON.stringify(classifyReportedObject(input), null, 2)}\n`);
}
