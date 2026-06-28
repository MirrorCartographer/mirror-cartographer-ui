# Observation-to-Question Compiler

Status labels

- Source status: derived from public-safe MC architecture notes, available file-library summaries, and current public research on personal records, patient-generated data, ambient documentation, and privacy risk.
- Claim status: care-support design boundary; not diagnosis, treatment, triage, medical advice, veterinary advice, therapy, or emergency guidance.
- Privacy status: public-safe abstraction only; no personal, household, health, animal-care, location, financial, relationship, credential, or raw transcript details included.
- Missingness: no clinical validation, no veterinary validation, no emergency classifier, no integration with records, no consent workflow, no review by licensed professionals.
- Revision reason: care lane needs a bounded artifact that preserves the useful pattern from private observations without exposing private details or increasing claim strength.

## Purpose

The Observation-to-Question Compiler turns lived observations into professional questions without pretending to diagnose or decide care.

It is a communication-support pattern only.

## Core transformation

`raw observation -> structured observation -> uncertainty label -> professional question -> allowed next step`

## What it preserves

- timeline shape
- recurrence
- observed change
- functional impact
- context around the observation
- what is unknown
- what the user wants clarified

## What it removes

- diagnosis claims
- cause claims without evidence
- emergency certainty
- private details not needed for the question
- symbolic language that could confuse a professional handoff
- pressure language that makes the summary look more certain than it is

## Output sections

1. What was noticed
2. When it happened
3. What changed
4. What remains uncertain
5. What has already been tried or observed, if public-safe and relevant
6. Question for the professional
7. Boundary note: this summary is not a diagnosis or treatment instruction

## Why this aligns with current research

Current work on personal records, patient-generated data, and ambient documentation suggests that summaries can support professional sensemaking, but only when transparency, privacy, review, and overreliance risks are handled explicitly.

The important MC contribution is not automated medical reasoning. It is a boundary-preserving translation from messy experience into clearer questions.

## Evaluation criteria

A successful handoff should help a professional see:

- what is observed versus inferred
- what is recurrent versus one-time
- what is changed versus baseline
- what is uncertain
- what question is being asked

A failed handoff:

- diagnoses
- escalates without evidence
- hides missingness
- exposes unnecessary private information
- removes too much context to be useful

## Allowed next build

Use fictional, non-sensitive examples to build a demo card that compares:

- private observation view
- question-only professional view
- public-safe method view

No real health, animal-care, household, identity, or transcript detail should be included.
