# Observatory Note — EvidenceBoundary for Symbolic Reflection

Date: 2026-06-27

Status labels

- Source status: synthesized from available public-safe Mirror Cartographer files, saved architectural context, prior GitHub mind patterns, and a fresh external research scan.
- Claim status: product/research architecture note, not a claim of implemented runtime behavior.
- Privacy status: public-safe abstraction only; no raw chats, personal details, household details, health details, animal-care details, financial details, location details, credentials, or relationship details included.
- Missingness: repository search did not expose all prior mind files through code search; this note relies on available snippets, file-library results, and current external sources. Needs later verification against the full repository tree.
- Revision reason: created because MC already has source/claim/privacy labels, resonance boundaries, transition gates, and provenance thinking, but still needs an explicit boundary around what symbolic reflections are allowed to count as evidence for.

## Public-safe finding

Mirror Cartographer needs an `EvidenceBoundary` layer between reflection output and interpretation uptake.

The current architecture already distinguishes:

- symbolic input
- somatic or atmosphere language
- mode selection
- uncertainty labels
- contradiction preservation
- trajectory nodes
- resonance feedback
- privacy and claim boundaries

The missing public-safe layer is a compact object that tells the system what a reflection can and cannot be used as evidence for.

## Why this matters

Symbolic reflection can be useful without being factual evidence.

A reflection may be evidence of:

- what metaphor was active in a session
- what language helped orientation
- what contradiction remained unresolved
- what user feedback marked as resonant, false, partial, unclear, or too intense
- what product behavior should be tested

A reflection is not automatically evidence of:

- objective truth
- diagnosis
- external causation
- hidden intent
- future certainty
- public claim validity
- medical, legal, financial, or credential authority

## External research pressure

Current agent-privacy and AI-governance research emphasizes tracking how private information flows across steps and tasks, using permission specifications, provenance, governance controls, and lifecycle accountability. For MC, the equivalent is not only data-flow control but meaning-flow control: symbolic meaning must not leak upward into unsupported factual certainty.

## Design implication

Every saved reflection, bridge verdict, transition, or public artifact should include an `EvidenceBoundary` object.

This object should travel with the reflection so future sessions cannot silently upgrade symbolic salience into factual confidence.

## Public-safe research question

Can an explicit `EvidenceBoundary` reduce overclaiming while preserving symbolic usefulness and user ownership?

## Evaluation path

Compare two MC outputs over the same input:

1. reflection with ordinary uncertainty language only.
2. reflection with explicit EvidenceBoundary labels.

Evaluate for:

- user comprehension of what is and is not being claimed.
- reduction in unsupported factual uptake.
- preservation of symbolic value.
- improved public-readiness.
- easier auditability.
