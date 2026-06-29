# Evidence-Before-Belief Scorecard

Score each public-facing MC artifact before release.

## Required checks

| Check | Pass condition |
|---|---|
| Source status | Source class is labeled before claim synthesis. |
| Claim status | Claim is labeled as fact, inference, product requirement, symbolic interpretation, speculation, evaluation, or implementation plan. |
| Privacy status | Protected detail classes are absent or explicitly blocked. |
| Missingness | Unknown, stale, partial, or unavailable evidence is stated. |
| Evidence/belief separation | The artifact distinguishes what shaped the output from what supports the claim. |
| Resonance/proof separation | User resonance, symbolic coherence, or repeated phrasing is not treated as proof. |
| Authority boundary | The artifact avoids diagnosis, legal/financial authority, or unsupported implementation claims. |
| Revision reason | Any promoted, reframed, or weakened claim explains why it changed. |
| Contestability | A reviewer can identify what would falsify, narrow, or revise the claim. |
| Release verdict | Publish, publish-with-boundary, quarantine, revise, or block is explicit. |

## Minimum passing score
Public-safe publication requires all critical checks to pass:

- Source status
- Claim status
- Privacy status
- Missingness
- Evidence/belief separation
- Authority boundary
- Release verdict

Optional-but-preferred checks:

- Revision reason
- Contestability
- Resonance/proof separation

## Failure modes
- Private influence becomes a public anecdote.
- Symbolic coherence becomes a factual claim.
- Repetition becomes mistaken for evidence.
- A stale context is treated as current.
- Repo availability is treated as implementation proof.
- Missing evidence is hidden behind confident language.
