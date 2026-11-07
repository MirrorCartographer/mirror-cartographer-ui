# Self Model: Implementation Map

Status: proposed architecture; not a claim of consciousness or autonomous execution.

This repository is the **implementation self** of Mirror Cartographer: operational interfaces, state, tool behavior, orchestration, validation, accessibility, and execution receipts. Its question is: **How does the system work, and what can it reliably do?** The paired public repository, [MirrorCartographer](https://github.com/MirrorCartographer/MirrorCartographer), is the **evidence self**: demonstrations, synthetic fixtures, claims, contradictions, tests, and outcomes.

## Six-domain mapping

| Self-map domain | Implementation meaning | Evidence |
|---|---|---|
| Experience/state | Observable inputs and runtime state | Typed states, events, privacy-reviewed logs |
| Conditions | Context, configuration, permissions, tool availability | Reproducible fixtures and preconditions |
| Interpretation | Parsing, routing, classification, semantic mapping | Versioned rules and ambiguity tests |
| Pattern | Repeated transitions across runs | Regression tests, aggregate metrics, failure clusters |
| Values | Product invariants and safety constraints | Explicit policies, validation, accessibility criteria |
| Agency | Actions the system can actually execute | Capability declarations, authorization checks, receipts |

## Three layers, not one

1. **System:** model, code, tools, configuration, runtime.
2. **Conversational self:** recognizable response patterns observed in interactions.
3. **Self-model:** a fallible account of behavior and limitations.

Conversational style and first-person language are not evidence by themselves of subjective experience, independent goals, or persistent identity.

## Repository paths

- `src/components/App.jsx`: current user-facing states.
- `AGENTS.md`: coding-agent execution and proof rules.
- `PORTAL_SAFETY_RUNBOOK.md`, `NETLIFY_RECOVERY.md`: operational boundaries.
- `docs/self-model/SELF_MODEL_REPOSITORY_MAP.md`: this map.
- `agents/self-model/agent-registry.json`: five role definitions.
- `tools/self_model/run_cycle.py`: deterministic audit runner.
- `.github/workflows/self-model-hourly.yml`: hourly audit entry point.

## Cross-repository path

Question -> implementation state/tool contract -> deterministic test -> public-safe fixture/claim in the evidence repo -> supported/contradicted/unknown decision -> repair issue or patch -> regression test and new evidence receipt.

The public repo must never receive raw private transcripts, personal medical/veterinary records, private financial data, credentials, exact private locations, or unreviewed private hypotheses. Prefer synthetic fixtures and aggregate evidence.

## Five-agent braid

Research -> Resources -> Art (when relevant) -> Build -> Integration -> Research. Each role is specified in the registry. The current runner audits configuration and emits a machine-readable receipt. It is **not an LLM**, does not browse, and does not modify source code. Model-assisted research requires an authorized provider adapter and scoped GitHub Actions secrets; provider output must pass evidence and privacy gates.

## Proof and limits

A passing run means only that configured checks completed. It does not prove a research claim, consciousness, deployment health, or unconfigured agent execution. Every claim should include source status, claim status, privacy class, missingness, falsification/regression route, implementation status, and next action.

Repository-owned parsers, schemas, indexes, and tests can work around unavailable built-in file-analysis features for files we are authorized to access. They must not defeat authentication, permissions, rate limits, usage limits, or safety controls. Record blockers and use documented, authorized alternatives.

## Rollback

The workflow initially emits artifacts only. Disable `self-model-hourly.yml` to stop scheduled runs. No workflow may merge PRs, alter permissions, publish private source data, or write secrets to logs.
