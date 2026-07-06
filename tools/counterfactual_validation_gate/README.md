# Counterfactual Validation Gate

## Purpose

Mirror Cartographer discovery memory should not promote a generated claim merely because it is plausible or cited. This gate requires every promotable packet to state what would change the decision: what evidence would hold, reject, or revise the claim.

This is public-safe research organization infrastructure. It does not provide medical, veterinary, diagnostic, or treatment advice.

## Frontier implication

Current scientific-AI work is converging on tool-grounded hypothesis generation, realistic scientific workflows, privacy-aware longitudinal data evaluation, and human-AI sensemaking. The actionable design implication for MC is that memory admission needs counterfactual decision logic, not only support evidence.

## Executable interface

Run:

`python tools/counterfactual_validation_gate/test_validate_counterfactual_packets.py`

Validate a packet file:

`python tools/counterfactual_validation_gate/validate_counterfactual_packets.py tools/counterfactual_validation_gate/fixtures.synthetic.json`

## Required packet fields

- source_status
- claim_status
- privacy_status
- missingness
- revision_reason
- implementation_status
- evidence_strength
- falsification_route
- next_executable_action
- measurable_variables
- evidence_items
- counterfactuals
- decision_boundary

## Acceptance criteria

A packet passes only when it has:

1. At least two evidence items.
2. At least two measurable variables.
3. At least two counterfactuals.
4. Complete promote/hold/reject decision boundaries.
5. A falsification route.
6. Public-safe or synthetic privacy status.
7. No medical/veterinary advice leakage.

## Falsification route

Revise this gate if curator review shows that counterfactual requirements fail to reduce unsupported discovery-memory promotions, or if they block well-grounded discovery workflows that have alternative explicit revision logic.
