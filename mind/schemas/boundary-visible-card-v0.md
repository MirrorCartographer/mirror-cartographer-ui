# Boundary Visible Card Schema v0

## Source status
- Derived from public-safe MC architecture work.
- Informed by adjacent 2026 research on AI literacy, provenance disclosure, and health-data consent.

## Claim status
- Schema proposal.
- Not implemented in production.
- Not clinically validated.

## Privacy status
- Public-safe schema only.
- Contains no private examples.

## Missingness
- Needs UI prototype.
- Needs user testing.
- Needs accessibility review.

## Revision reason
Adds a compact interface object for the Boundary-Visible Beauty Protocol.

## Card fields

### record_id
Stable fictional or consented record identifier.

### source_status
Allowed values:
- private_context_abstracted
- user_supplied_public
- file_library_public_safe
- web_source_bound
- synthetic_fixture
- unknown

### claim_status
Allowed values:
- observation
- interpretation
- hypothesis
- question
- requirement
- evaluation
- implementation_plan
- fictional_fixture

### privacy_status
Allowed values:
- private_only
- care_team_view
- public_safe_method
- research_safe_aggregate
- blocked

### transformation_status
Allowed values:
- preserved
- generalized
- redacted
- compiled
- translated
- omitted
- disputed

### missingness_status
Allowed values:
- complete_for_current_view
- missing_source
- missing_validation
- missing_consent
- missing_outcome
- missing_review
- intentionally_withheld

### revision_status
Allowed values:
- first_pass
- safety_rewrite
- claim_narrowed
- source_added
- privacy_tightened
- contradicted_by_new_source
- superseded

### next_safe_action
Allowed values:
- no_action
- ask_for_consent
- gather_source
- create_fictional_fixture
- professional_review
- usability_test
- market_test
- archive

## Minimum display contract
Every public card must show:

- Source status
- Claim status
- Privacy status
- Missingness status
- Revision reason

## Failure conditions
A card fails if:

- a private detail leaks into a public-safe view;
- a hypothesis is displayed as fact;
- a care-support packet implies diagnosis, treatment, or triage authority;
- a generated summary hides what it removed;
- a beautiful layout increases confidence without increasing clarity.
