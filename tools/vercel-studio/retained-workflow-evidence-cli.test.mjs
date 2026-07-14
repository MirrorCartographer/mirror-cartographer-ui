import test from 'node:test';
import assert from 'node:assert/strict';
import { link, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRetainedWorkflowEvidence, main } from './retained-workflow-evidence-cli.mjs';

const commitSha = 'a'.repeat(40);
const run = {
  id: 17,
  head_sha: commitSha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 23,
  run_attempt: 1
};
const acceptedRateLimitProof = {
  ok: true,
  promotion_permitted: true,
  evidence_class: 'dual_client_retained_response_header_contract',
  resource: 'actions',
  clients: {
    primary: { page_count: 1, minimum_remaining: 4998, classification: 'terminal_sequence_accepted' },
    independent: { page_count: 1, minimum_remaining: 4997, classification: 'terminal_sequence_accepted' }
  }
};

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'vercel-evidence-'));
  const paths = {
    primary: join(directory, 'primary.json'),
    ghPages: join(directory, 'gh-pages.json'),
    ghCommand: join(directory, 'gh-command.txt'),
    rateLimitProof: join(directory, 'rate-limit-proof.json'),
    output: join(directory, 'bundle.json')
  };
  await Promise.all([
    writeFile(paths.primary, JSON.stringify({
      complete: true,
      reason: 'exhausted_pagination',
      commitSha,
      pagesFetched: 1,
      runs: [run]
    })),
    writeFile(paths.ghPages, JSON.stringify([{ total_count: 1, workflow_runs: [run] }])),
    writeFile(paths.ghCommand, `gh api repos/o/r/actions/runs -f head_sha=${commitSha} --paginate --slurp\n`),
    writeFile(paths.rateLimitProof, JSON.stringify(acceptedRateLimitProof))
  ]);
  return paths;
}

function retainedInput(paths, overrides = {}) {
  return {
    commitSha,
    primaryPath: paths.primary,
    ghPagesPath: paths.ghPages,
    ghCommandPath: paths.ghCommand,
    rateLimitProofPath: paths.rateLimitProof,
    primaryRetrievedAt: '2026-07-13T00:00:00Z',
    ghRetrievedAt: '2026-07-13T00:01:00Z',
    generatedAt: '2026-07-13T00:02:00Z',
    ...overrides
  };
}

function validArgs(paths) {
  return [
    '--commit', commitSha,
    '--primary', paths.primary,
    '--gh-pages', paths.ghPages,
    '--gh-command', paths.ghCommand,
    '--rate-limit-proof', paths.rateLimitProof,
    '--primary-retrieved-at', '2026-07-13T00:00:00Z',
    '--gh-retrieved-at', '2026-07-13T00:01:00Z',
    '--generated-at', '2026-07-13T00:02:00Z',
    '--output', paths.output
  ];
}

test('builds a verified retained bundle from matching exhaustive outputs and accepted proof', async () => {
  const paths = await fixture();
  const bundle = await buildRetainedWorkflowEvidence(retainedInput(paths));
  assert.equal(bundle.verified, true);
  assert.equal(bundle.reconciliation.reason, 'independent_enumerations_match');
  assert.equal(bundle.independent_envelope.command_contract.paginate, true);
  assert.equal(bundle.independent_envelope.command_contract.slurp, true);
  assert.equal(bundle.rate_limit_proof.promotion_permitted, true);
  assert.match(bundle.rate_limit_proof_sha256, /^[0-9a-f]{64}$/);
});

test('fails closed when the retained gh command is not exhaustive', async () => {
  const paths = await fixture();
  await writeFile(paths.ghCommand, `gh api repos/o/r/actions/runs -f head_sha=${commitSha}\n`);
  const bundle = await buildRetainedWorkflowEvidence(retainedInput(paths));
  assert.equal(bundle.verified, false);
  assert.equal(bundle.reconciliation.reason, 'independent_non_exhaustive_command_contract');
});

test('CLI writes once and refuses to overwrite retained evidence', async () => {
  const paths = await fixture();
  const args = validArgs(paths);
  await main(args);
  const written = JSON.parse(await readFile(paths.output, 'utf8'));
  assert.equal(written.verified, true);
  await assert.rejects(() => main(args), /EEXIST/);
});

test('CLI requires the retained rate-limit proof argument', async () => {
  const paths = await fixture();
  const args = validArgs(paths);
  const flagIndex = args.indexOf('--rate-limit-proof');
  args.splice(flagIndex, 2);
  await assert.rejects(() => main(args), /missing_argument:rate-limit-proof/);
});

test('CLI rejects duplicate flags instead of silently taking the last value', async () => {
  const paths = await fixture();
  const args = validArgs(paths);
  args.push('--commit', 'b'.repeat(40));
  await assert.rejects(() => main(args), /duplicate_argument:commit/);
});

test('rejects malformed and impossible source timestamps', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { primaryRetrievedAt: 'yesterday' })),
    /primary_retrieved_at_timestamp_invalid/
  );
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { primaryRetrievedAt: '2026-02-30T00:00:00Z' })),
    /primary_retrieved_at_timestamp_invalid/
  );
});

test('rejects a bundle generation time that precedes either retained source', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, {
      ghRetrievedAt: '2026-07-13T00:03:00Z',
      generatedAt: '2026-07-13T00:02:00Z'
    })),
    /generated_at_precedes_source_retrieval/
  );
});

test('rejects retained source arguments that name the same file', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { ghPagesPath: paths.primary })),
    /retained_source_files_not_distinct/
  );
});

test('rejects a rate-limit proof path aliased to another retained source', async () => {
  const paths = await fixture();
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { rateLimitProofPath: paths.primary })),
    /retained_source_files_not_distinct/
  );
});

test('rejects hard-link aliases that name the same retained inode', async () => {
  const paths = await fixture();
  const hardLinkedProof = `${paths.primary}.hardlink`;
  await link(paths.primary, hardLinkedProof);
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { rateLimitProofPath: hardLinkedProof })),
    /retained_source_files_not_distinct/
  );
});

test('rejects symbolic links as retained evidence sources', async () => {
  const paths = await fixture();
  const linkedPrimary = `${paths.primary}.link`;
  await symlink(paths.primary, linkedPrimary);
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { primaryPath: linkedPrimary })),
    /primary_symlink_rejected/
  );
});

test('rejects a symbolic-link rate-limit proof', async () => {
  const paths = await fixture();
  const linkedProof = `${paths.rateLimitProof}.link`;
  await symlink(paths.rateLimitProof, linkedProof);
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths, { rateLimitProofPath: linkedProof })),
    /rate_limit_proof_symlink_rejected/
  );
});

test('rejects malformed retained rate-limit proof JSON', async () => {
  const paths = await fixture();
  await writeFile(paths.rateLimitProof, '{not-json');
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths)),
    /rate_limit_proof_json_invalid/
  );
});

test('rejects a retained rate-limit proof that does not permit promotion', async () => {
  const paths = await fixture();
  await writeFile(paths.rateLimitProof, JSON.stringify({
    ...acceptedRateLimitProof,
    promotion_permitted: false
  }));
  await assert.rejects(
    () => buildRetainedWorkflowEvidence(retainedInput(paths)),
    /dual_client_rate_limit_proof_not_accepted/
  );
});
