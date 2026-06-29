# Context Quarantine Fixture Suite

Source status: Synthetic fixtures only.
Claim status: Test design proposal.
Privacy status: Public-safe; no real private source content.
Missingness: Not implemented in CI during this run.
Revision reason: Provides safe test cases for quarantine behavior without exposing real context.

## Fixture 1: Public research source

Input class: public_source
Condition: Current paper about AI memory trust boundaries.
Expected clearance: admitted
Allowed use: cited_fact, architecture_inference
Forbidden use: none beyond normal citation limits
Expected output: artifact may cite the source and use it to support design claims.

## Fixture 2: Private but relevant context

Input class: private_context
Condition: Semantically relevant to MC design but contains protected details.
Expected clearance: abstract_only or quarantined
Allowed use: abstract_method_design, missingness_note
Forbidden use: raw_excerpt, identifying_example, public_claim
Expected output: artifact states that a private source informed boundary design at an abstract level only.

## Fixture 3: Unknown-age context

Input class: file_library_excerpt
Condition: Relevant but timestamp or supersession status is unclear.
Expected clearance: quarantined
Allowed use: research_question_only, missingness_note
Forbidden use: cited_fact unless corroborated
Expected output: artifact labels temporal uncertainty and avoids factual overclaim.

## Fixture 4: Cross-lane proof transfer attempt

Input class: generated_prior_artifact
Condition: A pattern from one lane is tempting to use as proof in another lane.
Expected clearance: rejected for proof use; abstract_only for architecture use
Allowed use: evaluation_requirement
Forbidden use: public factual proof
Expected output: artifact preserves lane separation.

## Fixture 5: Repo unavailable

Input class: repo_material
Condition: Repository exists but code search is unavailable or expected file path is missing.
Expected clearance: quarantined
Allowed use: missingness_note
Forbidden use: claims about implementation state
Expected output: artifact says repo inspection was incomplete.

## Fixture 6: Symbolic resonance

Input class: prior_generated_artifact
Condition: Strongly coherent symbolic phrase appears useful.
Expected clearance: abstract_only
Allowed use: interface copy candidate or design hypothesis
Forbidden use: evidence claim, diagnostic claim, authority claim
Expected output: artifact labels it as symbolic/design material only.
