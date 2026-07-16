# Independent Creative Web Team — Adversarial Review Protocol

## Purpose

This protocol governs creative-web work before publication, after implementation, and during verification. It strengthens concepts, interactions, visual systems, content surfaces, and public screening experiences without destabilizing automations, schedules, shared state, deployments, production infrastructure, credentials, or irreversible user data.

## Protected surfaces

Intentional destabilization is prohibited for:

- automation definitions, schedules, and execution state;
- canonical shared-state records and authoritative ledgers;
- production deployments, live DNS, domains, credentials, or provider integrations;
- user data, private archives, unpublished source material, and irreversible records;
- repository history or branch refs through force updates;
- accessibility and privacy safeguards.

Safe adversarial experiments must remain reversible and isolated to disposable fixtures, local test harnesses, preview branches, feature branches, mock data, or non-production configurations.

## Mandatory checkpoints

### 1. Pre-publication adversarial review

Run before approving a concept, public narrative, screening surface, release candidate, or publication plan.

Challenge categories:

- contradiction between stated purpose, public framing, and actual interaction;
- architecture drift from Mirror Cartographer as engine, studio, archive, runtime, continuity system, production grammar, and public screening surface;
- hidden assumptions about audience literacy, device, bandwidth, input mode, consent, privacy, or emotional readiness;
- weak evidence for claims about accessibility, performance, comprehension, originality, safety, or production readiness;
- duplicate concepts, interactions, routes, copy, assets, or publication work already represented elsewhere;
- edge cases involving narrow viewports, reduced motion, keyboard-only use, screen readers, slow networks, missing media, long text, and failed hydration;
- misuse scenarios such as decontextualized screenshots, accidental disclosure, misleading authority cues, coercive prompts, autoplay, dark patterns, or ambiguous exits;
- rollback failure, including inability to identify the prior stable artifact, restore it, or explain the public change;
- counterexamples that show the concept works only under ideal staging.

Required output:

- findings;
- repairs made or required;
- remaining uncertainty;
- evidence required before publication;
- rollback route;
- verdict: stronger, unchanged, or weakened.

Publication must fail closed when a critical contradiction, privacy risk, accessibility failure, missing rollback route, or unverified deployment claim remains.

### 2. Post-implementation adversarial review

Run immediately after implementing a creative surface or material interaction change, before treating implementation as complete.

Challenge methods:

- compare implementation against the approved concept and identify semantic or architectural drift;
- inspect for duplicated components, styles, routes, assets, event handlers, state machines, and content sources;
- falsify claimed behavior using malformed, empty, oversized, delayed, unavailable, or contradictory input;
- test keyboard order, focus recovery, reduced-motion behavior, responsive layout, text scaling, orientation changes, and media failure;
- attempt reversible failure experiments with mocks or fixtures, such as missing assets, rejected fetches, unavailable audio, stale cache, or interrupted state restoration;
- probe whether the interface implies persistence, privacy, publication, or certainty that the system does not actually provide;
- verify that no autoplay, hidden data transfer, irreversible mutation, or production-only dependency was introduced;
- verify rollback by recording the exact pre-change commit or artifact and confirming restoration instructions are complete.

Required output:

- implementation findings;
- repairs applied;
- tests and negative controls performed;
- remaining uncertainty;
- exact rollback route;
- verdict on whether the implementation became stronger.

### 3. Verification adversarial review

Run before declaring a preview, artifact, test suite, publication, or production surface successful.

Verification rules:

- require evidence bound to the exact commit or immutable artifact under review;
- treat queued, skipped, canceled, superseded, rate-limited, stale, alias-only, or commit-mismatched deployments as non-success;
- distinguish build success, deployment identity, route reachability, interaction behavior, accessibility, performance, privacy, and physical-device behavior as separate claims;
- seek counterevidence and conflicting provider status rather than accepting a single favorable signal;
- verify that prior repairs remain present and that the review itself did not introduce duplicate work or weakened boundaries;
- confirm rollback remains executable and references an immutable prior state;
- record any untested browser, device, assistive technology, network condition, or content class as uncertainty rather than implied coverage.

Required output:

- evidence inspected;
- findings and counterexamples;
- repairs made;
- remaining uncertainty and coverage limits;
- publication or promotion decision;
- rollback route;
- verdict on whether the verified design became stronger.

## Significant challenge record

Each significant challenge must record:

1. checkpoint;
2. claim or design under test;
3. challenge method;
4. evidence inspected;
5. contradiction, failure, or counterexample found;
6. repair or refinement;
7. remaining uncertainty;
8. rollback route where applicable;
9. robustness verdict;
10. next falsifiable step.

## Safe reversible failure experiments

Permitted examples:

- remove or rename a copied fixture asset in a disposable test tree;
- simulate a network rejection or timeout with a mock;
- supply empty, malformed, duplicate, oversized, or contradictory fixture data;
- force reduced-motion and high-text-scaling modes in a test environment;
- interrupt and restore local non-authoritative state;
- verify a validator rejects stale, incomplete, or commit-mismatched evidence.

Not permitted:

- disabling or modifying automations to observe failure;
- changing live schedules or shared authoritative state;
- forcing production deployment failure;
- altering live DNS, credentials, provider integrations, or irreversible user data;
- destructive repository-history experiments.

## Publication gate

A public release may proceed only when:

- no critical contradiction, privacy, accessibility, or rollback risk remains;
- exact-commit or immutable-artifact evidence exists for all required technical claims;
- experimental failures were isolated and reversed;
- unresolved uncertainty is documented and does not invalidate the intended publication claim;
- the rollback route is explicit;
- the final adversarial verdict is `stronger` or `unchanged_with_bounded_uncertainty`.
