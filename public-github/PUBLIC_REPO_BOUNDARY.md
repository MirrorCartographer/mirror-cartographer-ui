# Public Repository Boundary

Mirror Cartographer should have a public face and a private engine.

## Public face

Safe to publish:

- project thesis
- architecture
- demo interface
- redacted examples
- proof rules
- connector design summaries
- public-safe screenshots
- contribution requests
- value-exchange philosophy

## Private engine

Keep private unless reviewed and redacted:

- raw conversation exports
- detailed personal records
- detailed animal records
- exact financial details
- private relationship or family material
- unreviewed notes
- unverified claims

## Repository strategy

Recommended path:

1. Keep `MirrorCartographer/mirror-cartographer-ui` private as the working engine.
2. Create a separate public repository called `mirror-cartographer-public`.
3. Copy only reviewed public-safe files into it.
4. Use the public repository as the storefront, invitation, and demo space.
5. Keep sensitive source material out of the public repository.

## Current tool limit

The current GitHub tool can write files but does not expose a repository visibility switch or public-repository creation action.

A human must either make the current repository public in GitHub settings or create the new public repository manually.

Recommended: create the separate public repository.
