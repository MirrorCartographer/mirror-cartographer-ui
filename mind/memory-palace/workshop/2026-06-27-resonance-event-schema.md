# Workshop Spec — ResonanceEvent Schema

Date: 2026-06-27

Status labels

- Source status: implementation specification derived from public-safe MC architecture notes and current research scan.
- Claim status: product requirement and test plan, not a completed runtime feature.
- Privacy status: public-safe schema only; no raw private examples.
- Missingness: not implemented, not validated, and not connected to deployed state storage yet.
- Revision reason: added because MC needs a precise way to learn from resonance feedback without converting it into objective truth.

## Purpose

`ResonanceEvent` records how a user responds to a reflection, symbol, state, or bridge verdict.

It lets MC learn from interaction feedback while preserving source boundaries, privacy boundaries, and claim-status boundaries.

## Core object

Fields:

- `event_id`: stable identifier.
- `timestamp`: creation time.
- `target_type`: reflection, symbol, state, bridge_verdict, transition_gate, artifact, or prompt.
- `target_id`: referenced object.
- `resonance_mark`: resonant, partial, false, unclear, too_intense, useful_but_wrong, beautiful_but_untrusted, safe, unsafe, private_only, ready_to_test.
- `intensity`: optional low/medium/high or 0-1 rating.
- `user_note_redacted`: optional user note after privacy filter.
- `source_status`: user feedback, system inference, external source, mixed, unknown.
- `claim_status`: felt-valid, fact-unproven, source-backed, contradicted, speculative, implementation-hypothesis, unsafe-to-act-on.
- `privacy_status`: private-only, abstractable, publishable-method-only, do-not-store, delete-on-return.
- `allowed_updates`: symbolic_weight, contradiction_log, prompt_style, safety_route, privacy_route, evaluation_metric, none.
- `blocked_updates`: diagnosis, external fact, identity claim, public claim, action recommendation, permanent memory.
- `transition_gate_required`: true/false.
- `state_provenance_id`: linked provenance object when available.
- `revision_reason`: why the event changes or does not change the map.

## Update rules

1. A positive resonance mark may increase symbolic salience but not factual certainty.
2. A false or unclear mark must preserve the mismatch rather than overwrite it silently.
3. A too-intense or unsafe mark must lower intensity, change route, or stop the reflective mode.
4. A private-only mark must block public artifact use unless transformed into abstract method language.
5. A ready-to-test mark can move to evaluation or prototype planning only through TransitionGate.

## Evaluation metrics

- Relevance improvement across later sessions.
- Reduction in repeated false interpretations.
- Frequency of preserved contradictions.
- Frequency of unsupported claim escalation.
- User control over memory persistence.
- Privacy-safe compression success.
- Difference between felt validity and factual support in output labels.

## Failure modes

- Emotional fit gets treated as truth.
- The system stores raw sensitive notes unnecessarily.
- Contradictions get smoothed into a fake coherent narrative.
- A polished reflection is mistaken for validated product function.
- The system optimizes for pleasing resonance instead of useful reflection.
- User feedback becomes invisible hidden steering rather than inspectable provenance.

## First implementation task

Add a state-layer module that receives feedback from the reflection card and writes a `ResonanceEvent` linked to the current `StateProvenance` object.

The module should expose a public-safe export that includes only aggregate counts, schema fields, and abstracted transition patterns.
