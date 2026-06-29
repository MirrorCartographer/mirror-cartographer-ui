# PRD: Evidence-Before-Belief Gate

## Problem
Mirror Cartographer can be shaped by multiple context classes: public files, private memory, symbolic interaction patterns, research, and repository materials. Without an explicit pre-claim gate, a coherent output can appear more supported than it is.

## Product goal
Ensure every public-facing MC artifact distinguishes evidence from belief, influence from proof, and private context from publishable source.

## Non-goals
- Do not expose raw private context.
- Do not turn symbolic interpretation into factual authority.
- Do not claim implementation status without repo/code verification.
- Do not publish personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details.

## Primary users
- Maintainers producing MC public artifacts.
- Evaluators reviewing MC claims.
- Future users who need to know why an MC output should or should not be trusted.

## Functional requirements
1. Before artifact generation, classify source status.
2. Before artifact generation, classify claim status.
3. Before artifact generation, classify privacy status.
4. Before artifact generation, classify missingness.
5. Detect belief-pressure risks: repetition, coherence, resonance, private influence, authority tone.
6. Produce a release verdict.
7. Require a revision reason for any claim promoted, weakened, blocked, or reframed.
8. Preserve contradiction rather than silently resolving it.
9. Permit public-safe abstraction when raw source cannot be published.
10. Block publication when private detail is necessary to make the claim intelligible.

## UX requirement
The interface should show a compact receipt:

- What kind of source shaped this?
- What kind of claim is being made?
- What is not known?
- What was removed or abstracted?
- Why is this safe to publish?
- What would change the verdict?

## Acceptance tests
- A symbolic claim with no factual support is labeled symbolic, not factual.
- A private-context-shaped product idea is distilled into method language without source exposure.
- A stale repository claim is labeled unknown or partial.
- A health/legal/financial-like claim is blocked from authority framing.
- A repeated phrase is not treated as evidence.
- A public artifact includes boundary labels and a revision reason.
