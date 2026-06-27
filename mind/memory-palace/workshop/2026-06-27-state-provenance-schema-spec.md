# Workshop Spec — State Provenance Schema

Date: 2026-06-27

Status labels

- Source status: derived from bridge synthesis, public-safe MC files, and external provenance / AI governance standards.
- Claim status: implementation specification draft.
- Privacy status: public-safe abstraction; intended to prevent raw private context from leaking into published artifacts.
- Missingness: not implemented in application code; requires schema validation, UI design, and threat review.
- Revision reason: created to turn the provenance-aware reflection concept into buildable product behavior.

## Purpose

The `state_provenance` schema makes each MC output inspectable without requiring raw transcript storage.

It records how a reflection artifact was produced, what it claims, what it excludes, and how it should be evaluated.

## Core object

A future MC artifact should contain a compact metadata object with these fields:

- `artifact_id`: stable identifier.
- `created_at`: timestamp.
- `session_mode`: canonical, reflective, mythopoetic, dream_then_test, or other registered mode.
- `room`: threshold, forge, observatory, bridge, mirror_room, workshop, signal_tower, archive, garden, or storm_room.
- `source_status`: source classes used and their confidence level.
- `claim_status`: claim type and verification state.
- `privacy_status`: publication boundary and consent status.
- `missingness`: known gaps, unavailable context, uncertainty, or untested assumptions.
- `revision_reason`: why this artifact exists or changed.
- `source_classes_used`: abstract classes only, not raw material.
- `source_classes_excluded`: abstract classes intentionally excluded.
- `claim_type`: metaphor, observation, design hypothesis, product requirement, research claim, evaluation criterion, decision, or open question.
- `symbolic_elements`: symbols present after abstraction.
- `operational_variables`: variables extracted from symbol into product/evaluation language.
- `bridge_verdict`: preserve, refine, split, test, park, reject, or needs_review.
- `evaluation_criteria`: what would make the artifact useful, wrong, unsafe, stale, or ready.
- `review_after`: date or condition for review.

## Design rule

The schema should preserve meaning without preserving raw life.

It should support continuity without requiring exposure.

## UI requirement

Every reflection card should include a small expandable `Source / Claim / Privacy` panel.

Default view:

- Source: abstracted context + research + current session.
- Claim: metaphor / hypothesis / evidence / requirement.
- Privacy: safe to save, private only, or publishable after review.

Expanded view:

- missingness
- revision reason
- bridge verdict
- evaluation criteria

## Validation requirements

A reflection artifact cannot be exported as public-safe unless:

- `privacy_status` is publishable or abstracted.
- `source_classes_used` contains no raw private content.
- `claim_status` does not overstate evidence.
- `missingness` is not empty when uncertainty exists.
- `bridge_verdict` is present for research-informed outputs.

## Failure modes

- metadata becomes decorative rather than operational.
- privacy label is added after the fact rather than shaping generation.
- symbolic language hides unsupported factual claims.
- research citations become authority theater.
- schema feels bureaucratic and kills the reflective experience.

## First implementation step

Create a TypeScript type for `StateProvenance` and attach it to generated reflection cards before export or persistence.
