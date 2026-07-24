# Five-Steward Braid Control Plane

This directory coordinates the Research, Resources, Art, Build, and Integration stewards as one staged system rather than five independent agents.

## Hourly sequence

| Minute | Stage | Contract |
|---|---|---|
| `:05` | Research | Produce evidence and measurable acceptance criteria. |
| `:15` | Resources | Resolve one capability gap with cost, license, compatibility, and exit-path evidence. |
| `:25` | Art | Produce an editable visual artifact tied to an active semantic or usability objective. |
| `:35` | Build | Consume eligible handoffs and implement one bounded, tested change. |
| `:50` | Integration | Verify the cycle, reconcile contradictions, enforce WIP limits, and set the next queue. |

## Invariants

- One canonical queue and manifest.
- Every task declares `extends`, `repairs`, `consumes`, or `independent`.
- At most one active implementation lease.
- At most three active non-implementation tasks.
- At most one new pull request per cycle.
- Existing pull requests are repaired or extended before new overlapping work begins.
- Local and hosted test evidence remain distinct.
- Every handoff includes acceptance criteria, privacy class, rollback, and expiry.
- No steward writes directly to `main` or merges automatically.

## Files

- `manifest.json`: current cycle, WIP limits, leases, and task state.
- `queue.json`: prioritized work with dependencies and acceptance criteria.
- `handoff.schema.json`: machine-readable contract between stages.
- `receipts/`: authoritative integration receipts created at the end of each cycle.
- `handoffs/`: stage-to-stage evidence packets.

Run `npm run test:braid` before accepting a control-plane change.
