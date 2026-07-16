# Preview / Production Deployment Policy

## Objective

Separate intentional destabilization from the stable public experience.

## Branch roles

- `main`: production candidate and stable public surface.
- `preview`: adversarial integration branch. Experimental changes, reversible failures, architecture challenges, and cross-team integration happen here first.
- feature branches: isolated experiments feeding `preview`.

## Required path

1. Implement on a feature branch or `preview`.
2. Generate a Vercel Preview deployment.
3. Run build, smoke, mobile, accessibility, interaction, audio, deployment-identity, and rollback checks.
4. Run an intentional adversarial checkpoint: seek contradiction, architecture drift, weak evidence, duplication, edge cases, misuse, and rollback failure.
5. Record evidence and unresolved risk.
6. Promote to `main` only when the preview is verified and the rollback route is explicit.

## Production invariants

Production must not be used as the default destabilization environment. A production push must preserve:

- mobile safety
- no autoplay
- accessibility
- deployment identity
- reversible rollback
- continuity state
- no private source exposure

## Cancellation handling

A canceled deployment is not success. Record it as `canceled`, identify whether it was superseded, rate-limited, manually canceled, or skipped by build policy, and trigger a new preview only after the cause is understood.

## Ownership

The Vercel Studio Team owns preview verification and promotion evidence. Other teams may challenge or destabilize preview builds but may not silently promote to production.
