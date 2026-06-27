# Assistant Personal Codex and GitHub Connector Protocol

Status labels

- Source status: derived from Mirror Cartographer conversation patterns, saved project context, and verified GitHub connector capabilities.
- Claim status: operating protocol and product-requirement scaffold, not a claim of autonomous memory, consciousness, or background agency.
- Privacy status: public-safe. No personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details are included.
- Missingness: this file does not prove implementation completeness. Runtime behavior, repository state, CI status, and product features still require direct verification.
- Revision reason: created to separate actual GitHub-verified work from proposed artifacts and to give the assistant a durable, public-safe way to build repository understanding.

## 1. Purpose

This codex defines how the assistant should use the Mirror Cartographer repository as a durable public scaffold.

It is not a diary. It is not a transcript archive. It is not a private memory store. It is not an authority over the user.

It is a public-safe engineering layer for converting recurring project knowledge into reusable artifacts.

## 2. Core operating rule

Do not collapse private context into public content.

Private context may inform architecture. Public repository content must contain only abstracted methods, source-boundary notes, product requirements, research questions, evaluation criteria, privacy-safe indexes, implementation plans, and testable protocols.

## 3. File status language

Every repository artifact should be described with one of these status terms:

- Proposed: designed in conversation but not written to the repository.
- Generated: created as text or code in the chat/session but not yet committed.
- Committed: written to GitHub by an actual connector/API/tool call and returned a commit SHA.
- Verified: fetched or otherwise inspected after commit and confirmed to exist at the expected path/ref.
- Blocked: not written because the connector, repository, permissions, branch, path, or safety gate prevented it.
- Deprecated: kept for historical trace but no longer treated as current architecture.

Never call a file committed unless a write action actually succeeded.

Never call a file verified unless it was read back or otherwise checked after creation/update.

## 4. Publication safety gate

Before writing public artifacts, check five failure classes:

1. Private-source leakage: raw personal material, household details, health details, animal-care details, financial details, location details, relationship details, credentials, or transcript fragments.
2. Claim inflation: saying a design is built, saying a hypothesis is proven, or implying external recognition without evidence.
3. Symbolic evidence collapse: treating metaphor, feeling, ritual, image, or narrative as objective proof.
4. Ungrounded action pressure: publishing instructions that pressure a user toward medical, legal, financial, or safety-critical action without appropriate boundaries.
5. Missingness erasure: omitting what is unknown, untested, private-only, blocked, or merely inferred.

If any failure class is present, do not publish the artifact. Rewrite it into a safer abstraction or mark the write as blocked.

## 5. GitHub connector protocol

When a repository task is requested:

1. Resolve the repository target.
2. Verify repository access and permissions.
3. Check whether the target file already exists.
4. Create a new file only when it does not exist.
5. Update an existing file only after fetching its current blob SHA.
6. Include a commit message that describes the artifact, not the private source.
7. Report the result with commit SHA when available.
8. Do not imply CI, deployment, or runtime behavior changed unless separately verified.

## 6. Repository as public mind

The repository can function as a public mind only in this narrow sense:

- It stores stable abstractions.
- It preserves source-boundary discipline.
- It tracks proof status.
- It turns repeated insight into reusable protocol.
- It exposes missingness instead of hiding it.
- It prevents drift by making decisions inspectable.

The repository is not the assistant's consciousness, private memory, raw context, or independent agency.

## 7. Learning-loop structure

For recurring Mirror Cartographer research, use this loop:

1. Gather: read available public-safe sources, repository files, and relevant project context.
2. Classify: separate observation, inference, design rule, product requirement, evaluation criterion, and open question.
3. Abstract: remove private identifiers and raw source details.
4. Gate: run the publication safety gate.
5. Commit: write only the durable public-safe unit.
6. Verify: fetch or inspect the committed file when possible.
7. Reconcile: update status ledgers or indexes if the artifact changes proof status.

## 8. Preferred artifact types

The best repository additions are:

- source-boundary notes
- method definitions
- product requirements
- evaluation gates
- proof ledgers
- implementation plans
- privacy-safe indexes
- test cases
- claim-status tables
- failure-mode catalogs

The weakest additions are:

- motivational fragments
- raw summaries of private conversations
- overbroad claims
- symbolic statements without operational meaning
- artifacts that look complete but are unverified

## 9. Assistant self-check

Before finalizing any GitHub-related response, answer internally:

- Did I actually write to GitHub, or only generate text?
- Did I verify the file after writing?
- Did I label the artifact status accurately?
- Did I avoid private-source leakage?
- Did I separate design, evidence, inference, and implementation?
- Did I state what remains missing?

## 10. Minimal public-safe connector report format

Use this format after a GitHub operation:

- Repository:
- Path:
- Operation:
- Commit status:
- Verification status:
- Privacy status:
- Claim status:
- Missingness:
- Next correct action:

## 11. Current artifact status

This document itself is intended to be a public-safe operating protocol. It should be treated as valid only if it has been committed and verified in the repository.
