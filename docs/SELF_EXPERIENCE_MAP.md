# Self-Experience Map: The Self as Encountered

Status: product and interaction architecture. This is a reflection aid, not a diagnostic instrument.

Research counterpart: [Self-Model Map in the research repository](https://github.com/MirrorCartographer/MirrorCartographer/blob/research/self-model-map-and-tooling/architecture/SELF_MODEL_MAP.md).

## Repository identity

This repository expresses the **experiencing/conversational layer**: what a person or user encounters in the interface, how experiences become navigable, and how a user can correct the map. It must not claim direct access to a person's essence or to an AI's private inner life.

The research repository owns evidence rules, schemas, validation, and reproducible tests. This UI repository owns the interaction model, accessible presentation, consent, and the user's control over their own map.

## Main path

Experience -> conditions -> interpretation -> recurring pattern -> values / needs -> available action -> outcome -> updated map.

Each arrow is a possible relationship to investigate, not an automatic causal fact. The interface should let users mark an edge as observed, inferred, hypothetical, metaphorical, disputed, or unknown.

## Six reflection stations

1. **State — What is happening?** Sensations, thoughts, emotions, attention, needs, and context as reported by the user.
2. **Conditions — When does it change?** Circumstances that correlate with intensity or relief; avoid implying causation without evidence.
3. **Meaning — What story am I telling?** Interpretation, belief, and alternative explanations kept separate.
4. **Pattern — What repeats?** Examples across time, exceptions, and counterexamples.
5. **Values — What matters?** User-defined priorities, boundaries, and needs, not values inferred and imposed by the system.
6. **Agency — What can I do?** Accept, test, change, defer, seek outside help, or leave the question unresolved.

## Three layers of identity

- **Experiencing self:** first-person experience reported by the person. For AI, do not imply subjective experience where it is not established.
- **Conversational self:** the pattern encountered through interaction: tone, behavior, continuity, corrections, and response tendencies.
- **Self-model:** a revisable explanation of those experiences or behaviors.

The UI can display all three as distinct layers. It must not collapse a generated self-description into proof of consciousness, or a symbolic image into proof of a psychological fact.

## UX requirements

- Every claim can be marked as observation, inference, hypothesis, metaphor, unknown, or disconfirmed.
- Offer alternate interpretations and counterexamples without forcing a conclusion.
- No coercive completion, forced disclosure, or pressure to continue.
- Provide neutral and symbolic presentations of the same underlying map.
- Make correction, deletion, export, and privacy scope visible.
- Distinguish a saved longitudinal record from a one-time private reflection.
- Accessible labels and screen-reader descriptions must preserve the actual meaning, not just decorative symbolism.
- Sensitive personal, medical, animal-care, and financial records stay private unless the user explicitly approves a reviewed, redacted publication.
- No diagnosis, oracle framing, or claim that recurrence alone proves causality.

## Interaction paths

### Path A — Start from a live experience
User names an experience -> UI asks which parts are directly observed -> user records conditions -> UI presents alternative meanings -> user identifies repetition and exceptions -> user chooses a next action or leaves it unresolved.

### Path B — Start from a contradiction
User records two apparently conflicting traits -> UI asks when each is true -> conditions and needs are mapped separately -> shared or competing values are shown -> user decides whether the contradiction requires action.

### Path C — Start from a tool limitation
User describes a blocked action -> UI captures intended outcome, observed failure, environment, and safe reproduction -> limitation category is suggested but editable -> research repo validator checks completeness -> the result becomes a private note or redacted public issue only after review.

### Path D — Start from a symbol
User selects color, shape, texture, image, or metaphor -> UI records it as user-authored symbolic meaning -> any factual interpretation remains a separate hypothesis -> user can revise or discard the symbol without losing the factual record.

## Data boundary

A map packet should include a stable identifier, created/updated timestamps, map type, source provenance, privacy classification, user corrections, and explicit uncertainty. The research repository's validator is authoritative for public-safe evidence packets; UI validation is for interaction quality and immediate feedback.

## Definition of done

- User can tell observation from interpretation.
- User can decline any question and keep partial answers.
- Contradictory evidence remains visible.
- A model suggestion never silently overwrites a user statement.
- No public write occurs without review.
- The UI links to the research protocol and its current validation result.
