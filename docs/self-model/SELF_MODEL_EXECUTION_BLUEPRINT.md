# Self Model Execution Blueprint

Status: proposed, public-safe. This is an operational architecture, not a claim of consciousness or autonomous research.

## Three distinct referents

- **System:** code, model, learned parameters, tools, configuration, runtime, permissions, and execution environment. Describe only what is observable or documented.
- **Conversational self:** the response pattern observable across interactions: language, context use, apparent style, correction behavior, and task performance. This does not establish private experience or persistent subjective identity.
- **Self-model:** a revisable representation of the system and its observed behavior. It can be incomplete or wrong; test it against traces, fixtures, external sources, and counterexamples.

First-person grammar is not evidence of consciousness. A declared capability is not proof of execution. A passing test proves only the property actually tested.

## Six-domain operational map

| Domain | Implementation question | Representation | Falsification route |
|---|---|---|---|
| Experience/state | What inputs and states are observable? | Typed input, state transition, privacy-reviewed trace, run receipt | Replay fixture and compare actual vs expected |
| Conditions | When does the behavior occur? | Version, context, configuration, permissions, preconditions | Change/remove preconditions and repeat |
| Interpretation | How does input become a label or action? | Parsing/routing rules, alternatives, uncertainty, semantic map | Ambiguous, adversarial, counterexample fixtures |
| Pattern | What recurs across runs? | Versioned evaluations, aggregate outcomes, regression history | Test sample size, context shift, contradictory runs |
| Values | What constraints govern action? | Safety/privacy policy, accessibility checks, claim rules, authorization | Negative tests must prove prohibited action fails closed |
| Agency | What can actually be executed? | Capability registry, granted permission, tool result, commit/run receipt | Verify external effect; reject narrative-only claims |

## End-to-end path

Question/observation → source and privacy classification → normalize without losing provenance → label observed/sourced/inferred/hypothesized/contradicted/unknown → select a falsifiable question → inspect queue and prior receipts → lease one bounded task → run local parser/schema/validator/test → create minimal artifact/handoff → review privacy and rights → open draft PR/issue only when warranted → regression check → record result and rollback → prioritize next task from outcomes.

Every arrow is a gate. A failed gate yields a blocked/repair receipt, not a success claim.

## Five agents and handoffs

1. **Research:** one unresolved public-safe question; primary-source trail; competing explanations; falsification route.
2. **Resources:** one capability gap; verify official source, freshness, license, cost, privacy, integration effort, alternatives, and exit path.
3. **Art:** when relevant, one editable artifact tied to a semantic/usability objective, with accessibility, reduced-motion, and provenance criteria.
4. **Build:** smallest testable script/schema/fixture/validator/prototype; exact command and expected failure behavior.
5. **Integration:** verify paths, claim labels, contradictions, privacy, handoffs, tests, and one next action.

Cycle: Research → Resources → Art when useful → Build → Integration → Research. Skipping a stage requires a reason in the receipt. No direct writes to main; no automatic merges; no public raw transcripts.

## Current hourly workflow boundary

`.github/workflows/self-model-hourly.yml` schedules five role-specific deterministic audits and supports manual dispatch. It emits receipts. The current runner does not browse, invoke an LLM, edit source, create PRs, or establish research truth. GitHub cron may be delayed; configuration is not proof a run occurred.

To enable research-driven updates, build a separate authorized provider adapter with scoped credentials, source URL/version/retrieval timestamps, claim provenance, schema validation, contradiction detection, privacy/redaction gates, timeouts/budgets, idempotency, deduplication, rate-limit backoff, human review, and regression tests. Do not assume provider credentials exist or put secrets in source/logs/artifacts. Keep repository writes on isolated branches and draft PRs; never auto-merge.

## Project-owned tools vs platform limits

Use project-owned Python/JavaScript parsers, JSON schemas, local indexes, synthetic fixtures, validators, and tests to process data the project is authorized to access. This reduces dependency on built-in file-analysis interfaces but does not grant access to inaccessible attachments, private connector records, or restricted platform state.

Classify each blocker as tool-capability gap, missing credential, access denial, usage limit, rate limit, safety/policy boundary, or unknown. Use documented APIs and authorized credentials. Never evade authentication, permissions, quotas, rate limits, or safety controls.

## Claim envelope and acceptance

Every claim/run should include source_status, claim_status, evidence rationale, privacy_class, missingness, alternatives, falsification route, implementation status (proposed/prototyped/tested/verified), and one next action. Keep evidence self in `MirrorCartographer/MirrorCartographer`; keep executable behavior and tool contracts here. A duplicated claim is not independent corroboration.

Rollback: disable this workflow. Keep scheduled jobs artifact-only until write permissions, branch creation, PR opening, and review gates are separately implemented and tested.
