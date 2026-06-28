# Care Team Access Boundary

Status labels

- Source status: derived from public-safe MC architecture, current public research on personal health records, dynamic consent, single patient records, and health-data privacy incidents.
- Claim status: care-communication design note; not medical, veterinary, legal, or compliance advice.
- Privacy status: public-safe; excludes private cases and raw transcripts.
- Missingness: no professional pilot, no legal review, no security audit, no standards mapping, no consent UI.
- Revision reason: created to clarify the difference between personal-private records and care-team-accessible records.

## Core rule

A care-team-accessible view is not a copy of the private record.

It is a purpose-limited, consent-bounded export.

## Required distinction

### Private record

Contains whatever the person needs to preserve meaning and continuity.

This may include symbolic, emotional, sensory, narrative, uncertain, contradictory, or unfinished material.

### Care-team-accessible view

Contains only what helps approved helpers or professionals act appropriately within their role.

This may include observations, timelines, current questions, known constraints, and follow-up items.

## Why this matters

Care systems fail when information is either:

- too fragmented to be useful, or
- too exposed to remain safe.

MC should solve neither by flattening privacy.

The system should instead make a smaller, clearer, bounded view.

## Human and animal use boundary

For any human or animal care context, MC should treat itself as a support layer for observation, communication, and continuity.

Allowed:

- organize observations
- preserve uncertainty
- prepare questions
- maintain timelines
- summarize what changed
- document what is missing
- help review what to share

Not allowed:

- diagnose
- prescribe
- triage emergencies
- replace a licensed professional
- claim direct biological healing
- infer hidden causes from symbols alone

## Minimum fields for a care-team view

- audience
- purpose
- time range
- current concern or question
- observations
- recurrence
- functional impact
- changes over time
- what was tried
- what helped or did not help
- known constraints
- uncertainty
- missing information
- requested next action or question
- excluded private fields

## Access questions

Before generating a view, MC should ask internally:

- Who is this for?
- What role do they have?
- What do they need to know?
- What should they not see?
- What claim strength is allowed?
- What uncertainty must remain visible?
- What material should expire?
- What audit trail should be kept?

## Evaluation rubric

A care-team view passes if:

- it is shorter than the private record
- it does not expose unnecessary identity or private narrative
- it does not overclaim
- it preserves uncertainty
- it is useful to a professional or helper
- the user can inspect the transformation
- every included field has a reason

## Research direction

The next public-safe research task is to compare MC care-team access against three existing patterns:

1. Patient portal summaries.
2. Clinician-facing intake forms.
3. Personal caregiving logs.

The goal is to identify which fields are missing from ordinary systems when lived experience is messy, intermittent, sensory, or hard to describe.
