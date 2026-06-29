# Deployment Boundary Ledger

## Status labels

- Source status: public-safe abstraction from available MC materials and current public research.
- Claim status: architectural proposal; not an implementation claim.
- Privacy status: public-safe. No raw transcripts, personal details, household details, health details, animal-care details, financial details, location details, relationship details, credentials, secrets, keys, or deployment tokens are included.
- Missingness: repository code search/listing was not available in this run; root README was not found through the connector. This note therefore records a design requirement, not verified repository state.
- Revision reason: previous MC mind runs focused on source boundaries, claim transport, influence, context admission, quarantine, temporal validity, and compression loss. The next unresolved boundary is deployment: how a product artifact crosses from local concept, to repository structure, to hosted runtime, without losing source, claim, privacy, and configuration clarity.

## Finding

MC needs a Deployment Boundary Ledger: a public-safe record that separates what was designed, what exists in source control, what is deployed, what is configured by environment, and what has been verified at runtime.

A system can be conceptually coherent and still fail at the deployment boundary. The boundary failure is not merely technical. It can create false public claims, incorrect user trust, stale product narratives, or unsafe leakage if private context, secrets, screenshots, or raw implementation history are used as proof.

## Core phrase

A product is not public because it exists. It is public when its boundary has been proven.

## Why this matters for MC

Mirror Cartographer depends on boundary discipline. The same principle used for memory, source privacy, claim transport, and context admission should apply to build/deployment state.

The deployment layer needs to answer five questions before any public claim is made:

1. What artifact is being described?
2. Where is that artifact stored?
3. What runtime is actually serving it?
4. What claim is being made about its capability?
5. What proof is safe to publish?

## Public-safe architecture pattern

A Deployment Boundary Ledger record should classify each public-facing product claim into:

- design_intent: what the system is meant to do.
- repository_state: what source-controlled files are believed to exist.
- build_state: whether the build is verified, unknown, blocked, failing, or passing.
- deployment_state: whether the deployed URL is verified, unknown, blocked, failing, or passing.
- runtime_state: whether a feature was tested in the hosted environment.
- config_boundary: what environment-dependent requirements exist, without exposing secrets.
- proof_boundary: what can be shown publicly without leaking private inputs, credentials, screenshots, logs, or raw chats.
- revision_reason: why the public claim changed.

## Source boundary

Private or semi-private setup context may reveal the shape of the problem, such as repo/deployment mismatch, but the public artifact should not publish raw setup turns, screenshots, account paths, credentials, environment values, or user-specific troubleshooting details.

Only the abstract method crosses: keep source control, build target, hosting target, environment configuration, and runtime verification as separately labeled states.

## Claim boundary

Permitted public claims:

- MC has a proposed deployment-boundary audit layer.
- MC should not equate repository presence with hosted product capability.
- MC should label build, deployment, runtime, and configuration status separately.

Blocked claims unless separately verified:

- The app is deployed.
- A given endpoint works.
- A specific environment variable is configured.
- A specific hosted URL reflects the current repo.
- A specific feature works in production.

## Evaluation questions

- Does every product claim identify whether it is design, repo, build, deploy, runtime, or governance state?
- Does the record avoid exposing secrets or private setup history?
- Does it distinguish local success from hosted success?
- Does it preserve missingness instead of smoothing it into confidence?
- Does it record why a claim was revised?
- Does it prevent screenshots or raw transcripts from becoming public proof by default?

## Research connection

Current agent-memory and RAG research increasingly treats memory as stateful, temporal, and failure-prone under change. That same lesson applies to deployments: source state, build state, and runtime state can diverge. Temporal-validity work shows stale facts can persist unless systems explicitly retire or supersede them. Long-term memory work shows agents need structured event/state records rather than undifferentiated recall. Deployment claims need the same treatment: they are dated, stateful, and revocable.

## Implementation plan

1. Add a deployment boundary schema.
2. Require any public feature claim to attach a deployment boundary record.
3. Add a scorecard that distinguishes design, repo, build, deploy, runtime, and configuration states.
4. Add fixtures for common boundary failures.
5. Add release notes that state what was verified and what remains unknown.

## Release verdict

Public-safe to publish as an abstract MC architecture finding. Not safe to publish raw setup logs, screenshots, account paths, environment variables, hosted secrets, or private transcript fragments.
