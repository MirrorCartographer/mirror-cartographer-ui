# Privacy Memory Handle Builder

Executable Mirror Cartographer component for privacy-preserving research memory.

This component converts public-safe observation packets into stable memory handles that can be used for longitudinal linking without exposing raw text, names, addresses, emails, exact dates, or private residue.

It is designed to sit after retrieval boundary checking and before hypothesis generation, review packet export, or collaborator handoff.

## Cure / discovery tie

Mirror Cartographer needs memory across time, but cure/discovery work becomes unsafe if private raw observations are copied into every downstream packet. This builder keeps longitudinal continuity by producing deterministic handles from normalized, redacted fields while blocking unsafe input.

It improves:

- longitudinal pattern tracking
- privacy-preserving research memory
- collaboration readiness
- evidence-boundary routing

## Input shape

A JSON file containing an array of packets:

```json
[
  {
    "packet_id": "obs-001",
    "source_status": "synthetic",
    "claim_status": "observation_only",
    "privacy_status": "public_safe",
    "species_scope": "animal",
    "domain": "mobility",
    "phenomenon": "stiffness after travel",
    "time_bucket": "week_2026_07_01",
    "missingness": [],
    "revision_reason": "synthetic fixture"
  }
]
```

## Output shape

```json
{
  "component": "privacy_memory_handle_builder",
  "implementation_status": "executable",
  "records": [
    {
      "packet_id": "obs-001",
      "memory_handle": "mc_mem_...",
      "route": "memory_ready",
      "blocked_reasons": [],
      "retained_fields": {
        "species_scope": "animal",
        "domain": "mobility",
        "phenomenon": "stiffness after travel",
        "time_bucket": "week_2026_07_01"
      },
      "labels": {
        "source_status": "synthetic",
        "claim_status": "observation_only",
        "privacy_status": "public_safe",
        "missingness": []
      }
    }
  ]
}
```

## Routing rules

A packet routes to `memory_ready` only when all are true:

- `privacy_status` is exactly `public_safe`
- `claim_status` is one of `observation_only`, `hypothesis_seed`, `measurement_definition`, or `review_note`
- `source_status` is one of `synthetic`, `public`, or `redacted_public_safe`
- no identifier-like residue is detected in retained fields
- `missingness` is present as an array

Otherwise it routes to `blocked_for_redaction`.

## CLI

```bash
python tools/privacy_memory_handle_builder/build_privacy_memory_handles.py \
  tools/privacy_memory_handle_builder/fixtures.synthetic.json
```

Optional output file:

```bash
python tools/privacy_memory_handle_builder/build_privacy_memory_handles.py input.json --out handles.json
```

## Tests

```bash
python tools/privacy_memory_handle_builder/test_build_privacy_memory_handles.py
```

## Acceptance criteria

- Produces deterministic handles for identical normalized packets.
- Does not include raw private notes in output.
- Blocks private or unknown privacy status.
- Blocks identifier-like residue including emails, phone-like strings, street-address-like strings, and full-date strings.
- Requires explicit `missingness` array.
- Keeps claim status bounded; it never creates medical or veterinary advice.

## Public safety

Fixtures are synthetic. The component is not medical or veterinary advice. It only routes memory safety and creates non-identifying handles for downstream use.
