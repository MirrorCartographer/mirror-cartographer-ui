# Observation Gap Detector

Executable Mirror Cartographer component for longitudinal pattern tracking.

## Purpose

The Observation Gap Detector checks whether an observation stream has enough public-safe, labeled, time-bounded data to support downstream comparison. It does not diagnose, treat, recommend care, or make cure claims. It only identifies missingness, irregular sampling, privacy blockers, and measurement-definition gaps before evidence enters effect-window comparison or hypothesis generation.

## Cure / discovery tie-in

Discovery work fails when apparent patterns are built from hidden gaps. This component protects the cure/discovery ambition by making absence visible: missing baseline, missing follow-up, missing measurement definition, missing source chain, irregular sampling, or privacy-unsafe residue.

## Input schema

Input JSON must contain:

```json
{
  "stream_id": "public-safe-string",
  "domain": "human_observation | animal_observation | environment | literature_note | synthetic_test",
  "privacy_status": "public_safe | private | unknown",
  "claim_status": "observation_only | normalized_evidence | candidate_hypothesis | review_ready",
  "measurement_definition_status": "defined | partial | missing",
  "expected_interval_hours": 24,
  "max_gap_multiplier": 2,
  "observations": [
    {
      "timestamp": "2026-01-01T00:00:00Z",
      "measure_id": "symptom_intensity_0_10",
      "value_present": true,
      "source_status": "synthetic | user_report_public_safe | literature | unknown",
      "missingness": []
    }
  ]
}
```

## Output schema

The CLI emits JSON:

```json
{
  "stream_id": "...",
  "route": "pass | review | block",
  "gap_count": 0,
  "longest_gap_hours": 0,
  "missingness": [],
  "labels": {
    "source_status": "...",
    "claim_status": "...",
    "privacy_status": "...",
    "implementation_status": "executable"
  },
  "next_executable_action": "..."
}
```

## Routing rules

- `block` when privacy is `private` or `unknown`.
- `block` when measurement definition is missing.
- `review` when measurement definition is partial.
- `review` when fewer than 2 observations exist.
- `review` when any observation lacks a timestamp, measure id, or explicit missingness array.
- `review` when gaps exceed `expected_interval_hours * max_gap_multiplier`.
- `pass` only when privacy is public-safe, measurement is defined, at least two observations exist, and no excessive gaps are detected.

## Usage

```bash
python tools/observation_gap_detector/detect_observation_gaps.py \
  tools/observation_gap_detector/fixtures.synthetic.json
```

## Test

```bash
python tools/observation_gap_detector/test_detect_observation_gaps.py
```

## Acceptance criteria

1. Public-safe complete stream passes.
2. Private or unknown privacy blocks.
3. Missing measurement definition blocks.
4. Partial measurement definition routes to review.
5. Excessive timestamp gap routes to review.
6. Missing per-observation `missingness` routes to review.
7. Output always labels source status, claim status, privacy status, missingness, revision reason, implementation status, testability, and next executable action.
