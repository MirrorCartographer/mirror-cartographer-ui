import assert from 'node:assert/strict';
import { verifyIndependentExecutionProvenance } from './execution-provenance-binding.mjs';

const commit = 'a'.repeat(40);
const base = {
  commit_sha: commit,
  primary: {
    execution: {
      client_id: 'github-rest-enumerator', client_version: '1.0.0', invocation_id: 'run-primary-1',
      runner_id: 'runner-a', commit_sha: commit, started_at: '2026-07-14T01:00:00Z',
      completed_at: '2026-07-14T01:00:05Z', command_argv: ['node', 'enumerate.mjs', commit],
      environment_class: 'authenticated_repository_read'
    }
  },
  independent: {
    execution: {
      client_id: 'gh-api-cli', client_version: '2.0.0', invocation_id: 'run-independent-1',
      runner_id: 'runner-b', commit_sha: commit, started_at: '2026-07-14T01:01:00Z',
      completed_at: '2026-07-14T01:01:04Z', command_argv: ['gh', 'api', '--paginate', '--slurp'],
      environment_class: 'authenticated_repository_read'
    }
  }
};

function copy(value) { return structuredClone(value); }

assert.equal(verifyIndependentExecutionProvenance(base).verified, true);

const sameClient = copy(base);
sameClient.independent.execution.client_id = sameClient.primary.execution.client_id;
assert.equal(verifyIndependentExecutionProvenance(sameClient).reason, 'independent_client_reuses_primary_client');

const sameInvocation = copy(base);
sameInvocation.independent.execution.invocation_id = sameInvocation.primary.execution.invocation_id;
assert.equal(verifyIndependentExecutionProvenance(sameInvocation).reason, 'independent_invocation_reuses_primary_invocation');

const sameCommand = copy(base);
sameCommand.independent.execution.command_argv = [...sameCommand.primary.execution.command_argv];
assert.equal(verifyIndependentExecutionProvenance(sameCommand).reason, 'independent_command_reuses_primary_command');

const wrongCommit = copy(base);
wrongCommit.independent.execution.commit_sha = 'b'.repeat(40);
assert.equal(verifyIndependentExecutionProvenance(wrongCommit).reason, 'execution_commit_mismatch');

const reversed = copy(base);
reversed.primary.execution.completed_at = '2026-07-13T23:59:59Z';
assert.equal(verifyIndependentExecutionProvenance(reversed).reason, 'execution_time_reversed');

const badEnvironment = copy(base);
badEnvironment.primary.execution.environment_class = 'unauthenticated';
assert.equal(verifyIndependentExecutionProvenance(badEnvironment).reason, 'execution_environment_invalid');

const missing = copy(base);
delete missing.independent.execution;
assert.equal(verifyIndependentExecutionProvenance(missing).reason, 'execution_provenance_missing');

process.stdout.write('8 assertions passed\n');
