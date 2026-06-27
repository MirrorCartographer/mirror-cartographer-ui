# Emergent Care Interface Boundary

Status labels

- Source status: derived from GitHub mind care artifacts and current public healthcare AI news/research scanned on 2026-06-27.
- Claim status: public-safe product boundary and research note, not medical advice, diagnosis, treatment guidance, clinical validation, or care recommendation.
- Privacy status: public-safe abstraction; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details.
- Missingness: no clinical review, no patient testing, no regulatory review, no integration, and no evidence that MC improves outcomes.
- Revision reason: created to keep the medical/social-care lane active while preserving strict non-diagnostic boundaries.

## Core finding

The care/social-support lane should focus on `pre-clinical communication structure`, not medical interpretation.

The strongest public-safe product object is an interface that helps a person turn messy observations into a bounded, professional-facing summary while clearly marking uncertainty.

## External signal

Current healthcare AI development is moving toward patient-facing explanation, clinician-reviewed summaries, ambient documentation, and administrative support:

- Hartford HealthCare announced PatientGPT in 2026, a patient portal chatbot for explaining lab results, answering patient questions from records, scheduling support, conversation summaries, and escalation prompts; it is described as unable to prescribe medications or recommend specific treatments. Source: https://www.ctinsider.com/connecticut/article/hartford-healthcare-ai-chatbot-patient-records-22322509.php
- Cleveland Clinic's ambient AI scribe rollout was reported in 2026 as requiring physician review before notes enter records and as supporting summaries/instructions while concerns remain about privacy and inaccuracies. Source: https://www.businessinsider.com/cleveland-clinic-ambient-ai-scribe-reducing-doctor-workload-2026-06
- AWS announced Amazon Connect Health in 2026 to automate healthcare administrative workflows including scheduling, verification, history compilation, documentation, and coding. Source: https://www.reuters.com/business/healthcare-pharmaceuticals/amazon-launches-ai-enabled-platform-automate-healthcare-administrative-tasks-2026-03-05/

## MC boundary implication

MC should not compete with clinician-facing diagnosis, treatment, coding, or record-submission systems.

MC's safer adjacency is:

- help organize lived observations before a professional encounter.
- separate observation from interpretation.
- preserve uncertainty.
- generate questions, not conclusions.
- show what the summary cannot prove.
- encourage professional review for care decisions.

## Emergent care interface

A care communication card should synchronize five layers:

1. Observation layer: what was noticed.
2. Time layer: when and how often.
3. Impact layer: what changed in function or need.
4. Uncertainty layer: what is unknown or ambiguous.
5. Conversation layer: questions to bring to a professional.

## Explicit blocked uses

Do not use this interface to:

- diagnose.
- predict urgency.
- recommend treatment.
- recommend medication changes.
- replace professional evaluation.
- convert metaphors into biological claims.
- rank symptoms by severity without a clinician.

## Public-safe build direction

Create fictional examples only.

The first demo should show a messy, fictional observation note becoming:

- a short summary.
- a question list.
- a missingness section.
- a non-diagnostic boundary label.

## Evaluation criteria

A good card is:

- clearer than the original note.
- shorter than the original note.
- uncertainty-preserving.
- non-diagnostic.
- professional-conversation oriented.
- privacy-aware.
- easy to correct.

## Next concrete action

Create a fictional `CareCommunicationCard` demo and compare it against an unstructured note for clarity, boundary safety, and usefulness.
