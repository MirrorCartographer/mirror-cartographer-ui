# Proof Logging Standard

## Voice-readable summary

Every serious claim needs a proof trail. A proof trail means the claim is tied to a repo file, PR, issue, workflow run, artifact, commit, dataset, command, or limitation statement.

The goal is not to look impressive. The goal is to make the work auditable.

## Universal rule

No important claim should exist only in chat.

If a claim matters, it must be recorded in one of these places:

- PR body
- issue body
- report file
- benchmark result artifact
- proof ledger entry
- commit message
- test file
- workflow log

## Required fields for performance claims

A performance claim must include:

1. Claim.
2. Dataset or input set.
3. Commit SHA or branch.
4. Workflow run ID or command.
5. Artifact ID or report path.
6. Measured result.
7. Limitation statement.
8. Next proof gate.

## Required fields for tool claims

A tool claim must include:

1. What the tool does.
2. What files implement it.
3. What tests exist.
4. What safety boundary applies.
5. What is not proven yet.
6. How to reproduce or inspect the result.

## Required fields for safety/bounty claims

Safety-related claims must include:

1. Program scope.
2. Authorized context.
3. Safe reproduction boundary.
4. Report template or evidence standard.
5. Explicit forbidden content boundary.
6. No challenge content, exploit steps, unsafe biological instructions, or NDA-covered details outside the authorized environment.

## Required fields for delegated-action claims

Delegated-action claims must include:

1. Who owns the account/action.
2. What the assistant prepared.
3. What the human must authorize.
4. Whether submission/payment/legal/identity action is involved.
5. What logs exist.
6. What cannot be done without human confirmation.

## Claim labels

Use one of these labels:

- `verified`: supported by a proof artifact.
- `measured`: supported by a benchmark or test result.
- `implemented`: code/docs exist, but performance is not proven.
- `planned`: design exists, not built.
- `speculative`: idea only.
- `forbidden`: outside allowed safety/action boundary.

## ARC example

Allowed claim:

On PR #10, the ARC Training Smoke Benchmark ran on the first 20 public ARC-AGI-2 training tasks and scored 2/20 pass-at-two, with both workflows passing. This does not prove ARC competitiveness.

Forbidden claim:

We can win ARC now.

## Core phrase

Proof turns momentum into memory.
