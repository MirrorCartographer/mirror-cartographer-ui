# AGENTS.md

## Purpose

This file gives Codex-style coding agents the operating rules for the Mirror Cartographer repo.

## Core rule

100% is the target condition. It is not a claim until a proof artifact shows it.

## Working model

- ChatGPT is the control room.
- GitHub is the machine room.
- Codex Desktop or local Codex is the execution worker.
- The human remains the owner and final submitter for competitions, accounts, payments, and legal actions.

## ARC rules

When modifying ARC code:

1. Keep evaluation offline and reproducible.
2. Do not add internet/API dependencies to solver execution.
3. Maintain two-attempt semantics.
4. Preserve locked-before-comparison separation where applicable.
5. Add tests for every new generator or primitive.
6. Run `python -m pytest engines/arc/tests -q` before proposing merge.
7. Run or trigger the ARC training smoke benchmark when solver behavior changes.
8. Record any score claim under `reports/arc` or in the PR body with run ID/artifact ID.
9. Do not claim ARC competitiveness from toy tests.

## Proof rules

Any claim about improvement must include:

- dataset or test set
- commit or branch
- command or workflow
- items total
- attempt one correct
- attempt two correct
- pass-at-two correct
- pass-at-two accuracy
- failure count
- limitation statement

## Safety rules

Do not add:

- exploit instructions
- jailbreak prompts
- unsafe biological content
- credentials or secrets
- payment credentials
- platform-rule bypasses

Safety-related files should remain high-level, scoped, reproducible, and mitigation-oriented.

## Accessibility rules

Critical instructions must be voice-readable in normal prose. Do not put essential meaning only in code fences, tables, or artifacts.

## PR rule

A PR should explain:

1. What changed.
2. Why it changed.
3. What proof exists.
4. What is still not proven.
5. The next proof gate.
