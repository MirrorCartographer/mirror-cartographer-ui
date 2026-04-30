# Codex Desktop Bridge

## Voice-readable summary

This protocol connects the ChatGPT control-room workflow to Codex Desktop or local Codex execution. The goal is to let Codex work on the repo while preserving the same proof gates, safety boundaries, and user ownership rules.

## Roles

ChatGPT:
- defines tasks
- writes specs
- checks proof claims
- reviews PRs
- keeps the strategy aligned

Codex Desktop or local Codex:
- edits files locally
- runs tests
- inspects repo context
- creates patches or PRs
- follows `AGENTS.md`

Human owner:
- authorizes GitHub connection
- controls credentials
- submits to Kaggle or external competitions
- approves payments, legal actions, and account-sensitive steps

## Setup boundary

The assistant should not receive passwords, private keys, payment credentials, or unrestricted account credentials.

Use official sign-in, GitHub authorization, and least-privilege connections.

## Handoff packet format

Every Codex handoff should include:

1. Objective.
2. Files likely involved.
3. Allowed changes.
4. Forbidden changes.
5. Tests to run.
6. Expected proof artifact.
7. Claim boundary.
8. Next PR title.

## ARC handoff template

Objective:
Improve ARC smoke benchmark from the current baseline without breaking proof gates.

Files likely involved:
- `engines/arc/blinded_dual_track_solver_v2.py`
- `engines/arc/tests/`
- `engines/arc/FAILURE_TAXONOMY.md`
- `reports/arc/`

Allowed:
- add offline generators
- add tests
- improve failure labeling
- improve benchmark reports

Forbidden:
- internet/API dependencies during solver execution
- hidden-data assumptions
- benchmark claims without artifacts
- removing dual-attempt semantics

Tests:
- `python -m pytest engines/arc/tests -q`
- ARC Training Smoke Benchmark workflow

Current verified ARC smoke baseline:
- first 20 public ARC-AGI-2 training tasks
- pass-at-two: 2/20
- pass-at-two accuracy: 0.10

Next target:
3/20, then 4/20, continuing toward 100% as a target condition.

## Universal tool rule

For every tool, the target is maximum correctness, but claims must be earned through tests, artifacts, or external validation.
