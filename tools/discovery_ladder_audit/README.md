# Discovery Ladder Audit

Public-safe Mirror Cartographer discovery infrastructure artifact.

## Purpose

The discovery ladder audit is an executable evaluation harness for identifying the weakest current rung in a discovery pipeline without reading private transcripts, personal records, health details, animal-care details, financial details, credentials, or location data.

It evaluates public-safe artifact manifests and reports which discovery rung has the lowest executable coverage.

## Discovery ladder

1. unresolved phenomenon map
2. novel hypothesis
3. mechanistic model
4. falsifiable prediction
5. synthetic fixture or dataset schema
6. evaluation/test harness
7. prototype/tool/code
8. literature/evidence crosswalk
9. collaborator/opportunity path
10. failed-result or contradiction ledger

## Claim boundary

This harness makes no medical, veterinary, therapeutic, biological, or scientific discovery claim. It only evaluates whether discovery infrastructure has enough public-safe scaffolding to move artifacts through testable stages.

## Acceptance criteria

The harness must:

- operate only on public-safe synthetic manifests;
- reject manifests containing private markers;
- compute deterministic rung coverage;
- identify the weakest rung using explicit scoring rules;
- emit a machine-readable report;
- fail when required labels are missing;
- preserve source, claim, privacy, missingness, implementation, and testability status fields.

## Test command

```bash
python tools/discovery_ladder_audit/test_discovery_ladder_audit.py
```
