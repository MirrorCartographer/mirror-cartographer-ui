# Museum of Becoming — Exhibit Schema

Status labels

- Source status: derived from public-safe GitHub archaeology, current repository commit patterns, and architecture-level File Library search results.
- Claim status: product architecture schema and evaluation framework.
- Privacy status: public-safe; contains no raw transcript, personal, household, health, animal-care, financial, location, relationship, credential, or secret details.
- Missingness: this schema has not yet been implemented as a UI route. It does not include every historical MC artifact. It defines how future exhibits should be created.
- Revision reason: created to make repository evolution navigable as transformation rather than a flat changelog.

## Purpose

The Museum of Becoming is a public-safe interface for MC evolution.

It answers:

What changed?
What survived?
What disappeared?
What became newly possible?
What evidence supports the claim?
What remains missing?

## Exhibit contract

Every exhibit must include:

- Exhibit ID
- Title
- Date or evidence window
- Source status
- Claim status
- Privacy status
- Missingness
- Revision reason
- Before state
- Mutation event
- After state
- Surviving traits
- Superseded traits
- Evidence anchors
- Public-safe interpretation
- Open questions
- Next room unlocked

## Evidence ladder

Use the weakest sufficient label honestly.

1. Verified file evidence — direct file content, commit, or accessible artifact.
2. Verified metadata evidence — commit message, path, timestamp, repo metadata, search result.
3. File Library artifact evidence — chunk-retrieved or uploaded artifact; not exhaustive unless fully parsed.
4. Current-context evidence — available conversation context only.
5. Interpretation — coherent synthesis from evidence; not proof.
6. Speculation — useful possibility; must not be presented as fact.

## Privacy gate

An exhibit may use private source material only if it is transformed into one of these safe forms:

- method
- product requirement
- source-boundary rule
- evaluation criterion
- abstract system pattern
- implementation plan
- research question
- privacy-safe index

An exhibit must not include:

- raw transcript text
- personal or household details
- health or animal-care details
- financial details
- precise location details
- relationship details
- credentials, secrets, keys, or account access data
- claims that imply external facts without source-specific evidence

## Initial exhibit queue

1. The First Seed — earliest verified README / intention fossil.
2. Three Voices — early tone selector and tone persistence.
3. Reflection Becomes State — shift from generated reflection to mapped continuity.
4. Bridge Appears — separation of inner meaning and external evidence.
5. Boundary Becomes Architecture — source-boundary, release-profile, and evidence-boundary organs.
6. Memory Admission — conditions for what enters durable memory.
7. Genesis Opens — repository archaeology as a first-class organ.
8. Logging Field — field logs, Weather Engine, and Museum routing.

## Acceptance tests

An exhibit is acceptable only if:

- a reader can tell what is evidence and what is interpretation;
- private source material is not exposed;
- the claim survives removal of personal context;
- the exhibit identifies missing sources;
- the exhibit explains why the mutation matters;
- the next research or implementation action is clear.

## Design note

This museum is not nostalgia. It is an interface for understanding system evolution.

Most repositories privilege the newest state. MC should make the path of becoming inspectable, because the transformation path is part of the product.
