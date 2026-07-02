# Evidence Map: AI Opportunity Fit Scoring Validation Boundary

Date: 2026-07-02
Run: Evidence Engine run 61
Area: AI opportunity work / job matching / resume targeting
Claim ID: C-AI-OPPORTUNITY-FIT-SCORING-01R
Status: Partially supported as a triage/navigation method; unvalidated as proof of job suitability or selection likelihood.

## Claim tested

Weak claim / assumption tested:

> AI-generated opportunity matching or “fit scoring” can identify the best high-paying roles for a person and can be treated as evidence that the person is suitable for those roles.

## Why this needed testing

The AI opportunity work has repeatedly used rapid role mapping, resume targeting, and “best fit” language. That can be useful for navigation, but it risks overstating certainty if the system has not validated the role criteria against job-relevant evidence, outcome data, or known selection standards.

This matters because a confident-sounding AI match can create false precision: it may feel like a hiring signal even when it is only a structured guess.

## Evidence reviewed

### Source 1 — NIST AI Risk Management Framework

Source: NIST, AI Risk Management Framework page and AI RMF 1.0 materials.
URL: https://www.nist.gov/itl/ai-risk-management-framework

Relevant facts:

- NIST describes the AI RMF as a framework for managing risks to individuals, organizations, and society associated with AI systems.
- The framework is intended to improve the ability to incorporate trustworthiness considerations into the design, development, use, and evaluation of AI products, services, and systems.
- NIST emphasizes lifecycle risk management, evaluation, and trustworthiness rather than accepting AI outputs as self-validating.

Use in this evidence map:

AI opportunity scoring should be treated as an AI-assisted decision-support artifact. It needs evaluation, traceability, and known limitations. A score or ranking alone is not evidence that the system is valid.

### Source 2 — O*NET Content Model

Source: O*NET Resource Center, The O*NET Content Model.
URL: https://www.onetcenter.org/content.html

Relevant facts:

- O*NET organizes job and worker information into a structured model.
- It separates worker characteristics, worker requirements, experience requirements, occupational requirements, occupation-specific information, and labor-market information.
- O*NET defines measurable constructs such as abilities, skills, knowledge, work activities, work context, tasks, job titles, labor-market information, and occupational outlook.
- O*NET’s model is based on research about jobs and how people work.

Use in this evidence map:

Opportunity matching should map claims to explicit occupational constructs: skills, tasks, knowledge, abilities, work context, education/credential expectations, salary/labor-market data, and role-specific evidence. “Feels like a fit” is not enough.

### Source 3 — EEOC guidance on employment tests and selection procedures

Source: U.S. Equal Employment Opportunity Commission, Employment Tests and Selection Procedures.
URL: https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures

Relevant facts:

- Employment tests and selection procedures can be effective for identifying qualified applicants, but they can violate anti-discrimination law if discriminatory or if they disproportionately exclude protected groups without legal justification.
- EEOC states that neutral selection procedures with disparate impact must be job-related and consistent with business necessity.
- EEOC says the challenged policy or practice should be associated with the skills needed to perform the job successfully.
- EEOC distinguishes general measures of skill from measures tied to the particular job in question.
- EEOC notes that UGESP provides methods for showing that tests and other selection criteria are job-related and consistent with business necessity, known as test validation.

Use in this evidence map:

If MC / GitHub mind uses AI-generated fit scores, they must not be described as validated selection measures. They are only exploratory unless linked to job-related criteria and tested against outcomes.

### Source 4 — EEOC Q&A on Uniform Guidelines on Employee Selection Procedures

Source: U.S. Equal Employment Opportunity Commission, Questions and Answers to Clarify and Provide a Common Interpretation of the Uniform Guidelines on Employee Selection Procedures.
URL: https://www.eeoc.gov/laws/guidance/questions-and-answers-clarify-and-provide-common-interpretation-uniform-guidelines

Relevant facts:

- UGESP clarifies how selection procedures should be interpreted and validated.
- The guidance is relevant when tests, procedures, or criteria are used in employment decision contexts.

Use in this evidence map:

AI-generated opportunity ranking is not itself an employment selection procedure when used privately for navigation, but the closer it moves toward “this proves suitability” or “this should be used to screen/rank candidates,” the more it needs validation logic and anti-discrimination safeguards.

## Fact vs. inference

### Supported by evidence

- Job fit should be evaluated against job-related constructs, not vague confidence language.
- O*NET provides a structured source for describing job requirements, worker requirements, tasks, skills, abilities, work context, and labor-market features.
- EEOC guidance requires job-relatedness and business necessity when selection tools or procedures disproportionately affect protected groups.
- AI-generated rankings require evaluation and limitation tracking before being treated as trustworthy decision support.

### Reasonable inference

- AI opportunity work can be useful as a triage layer for identifying roles worth investigating.
- A structured AI map can help translate a person’s background into role-relevant evidence if every match is tied to explicit job requirements.
- AI-generated fit scores may reduce overwhelm, but only if they remain provisional and auditable.

### Not demonstrated / not supported yet

- That any current MC/GitHub opportunity score predicts interview probability.
- That AI can identify the “best” high-paying job without real outcomes data.
- That resume targeting will pass employer-specific ATS or recruiter filters.
- That current opportunity matching distinguishes actual qualifications from narrative plausibility.
- That the system avoids bias or unfair filtering when generalized to other users.

## Claim-status update

Retire or narrow any stronger claim equivalent to:

> AI can identify the best role or prove role suitability from narrative background alone.

Replace with:

> AI opportunity matching is a navigation and hypothesis-generation method. It may organize job-search strategy by mapping a person’s evidence to role requirements, but it does not validate suitability, ATS performance, interview likelihood, compensation likelihood, or hiring outcome without job-specific criteria, provenance, and outcome tracking.

Status: Partially supported as workflow scaffolding; unvalidated as predictive selection evidence.

## Evaluation criterion added

### OPP-FIT-JOB-RELATEDNESS-CRITERION-01

Every AI-generated opportunity recommendation must include:

1. Role title and source job posting or occupational profile.
2. Required skills / knowledge / abilities.
3. Required credentials, experience, or portfolio evidence.
4. Work-context constraints: remote/on-site, meetings, schedule, communication load, travel, physical demands.
5. Compensation evidence and source date.
6. User evidence mapped directly to each requirement.
7. Evidence gaps that would weaken the application.
8. Inference type: direct evidence, transferable evidence, weak analogy, speculative fit.
9. Confidence level based on evidence quality, not tone.
10. Outcome tracking field: applied, response, interview, rejection, offer, compensation, no data.
11. Revision trigger when outcome data contradicts the score.

## Falsification checklist

The opportunity-fit claim fails if:

- The recommendation cannot cite a specific job posting or occupational profile.
- The match uses personality/aesthetic resonance instead of job requirements.
- Required credentials are missing but not flagged.
- Compensation is guessed or outdated.
- The system rates a role highly while omitting a hard disqualifier.
- The resume/application evidence does not map directly to stated role requirements.
- Ten or more high-score applications produce no response and no score recalibration occurs.
- A lower-scored role consistently produces better outcomes without the model updating its criteria.
- The score is presented as hiring likelihood without outcome data.

## Test plan

### OPP-FIT-VALIDATION-PILOT-01

Sample:

- 30 opportunity recommendations across high-paying remote, part-time, AI, research, evaluation, operations, and creative-technical roles.

Procedure:

1. Capture the original AI-generated recommendation and score.
2. Capture the job posting or O*NET occupational profile used.
3. Decompose each role into required and preferred criteria.
4. Map user evidence to each criterion.
5. Mark every fit claim as direct, transferable, weak analogy, speculative, or unsupported.
6. Submit applications only where evidence gaps are explicitly known.
7. Track outcomes for each role.
8. Recalibrate the scoring rubric after every 10 outcomes.

Metrics:

- Percent of recommendations with complete role evidence.
- Percent with hard disqualifiers missed.
- Percent of fit claims based on direct evidence.
- Percent based on speculative inference.
- Response rate by score band.
- Interview rate by score band.
- False-confidence count: high score, weak evidence, no outcome.
- Recalibration actions after contradictory outcomes.

## Boundary rule for future GitHub mind entries

Do not write:

- “best role”
- “guaranteed fit”
- “will get flagged by hiring AI”
- “ATS optimized” without parser or outcome evidence
- “high probability” without application-outcome data

Use instead:

- “candidate role hypothesis”
- “evidence-mapped opportunity”
- “stronger/weaker match based on current evidence”
- “unvalidated fit score”
- “requires outcome tracking”

## Next proof needed

Run `OPP-FIT-VALIDATION-PILOT-01` on 30 opportunity recommendations and publish a ledger showing which fit scores were based on direct evidence, transferable evidence, weak analogy, speculation, or unsupported narrative plausibility. The next real proof is not another theoretical source; it is application-outcome tracking and score recalibration.
