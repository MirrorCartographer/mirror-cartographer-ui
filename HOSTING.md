# Hosting and release policy

**Canonical public publisher:** GitHub Pages  
**Build authority:** the repository's GitHub Actions workflows  
**Source of truth:** the Git commit and its verified build artifact

## Supported path

1. A reviewed commit enters `main`.
2. `.github/workflows/publish-github-pages.yml` validates the source, generates the public-safe catalog, builds the static application, and checks the deployment identity.
3. The workflow publishes the resulting artifact through GitHub Pages.
4. Public routes are considered live only after the Pages deployment and route checks succeed.

The public entry point is:

- [The House of Mouths](https://mirrorcartographer.github.io/mirror-cartographer-ui/)
- [The Living Country](https://mirrorcartographer.github.io/mirror-cartographer-ui/?view=workshop&lane=country)

## Retired provider path

The former Vercel build configuration, deployment commands, and automatic Vercel-specific workflows have been removed from the supported release path. They are not prerequisites for local development, testing, or publication.

Historical provider evidence and engineering records remain in the repository where they explain prior decisions. They are retained as historical provenance, not as active deployment instructions. Do not restore a provider-specific config or deployment command without an explicit architecture decision.

## Boundaries

- A source file existing in GitHub does not prove that it is published.
- A successful build does not prove that the public route is reachable.
- A deployment identity record proves only the fields and commit it explicitly covers.
- Local previews are development tools, not production URLs.
- Do not publish private-repository content through a public catalog or Pages artifact.
- Disconnecting an external GitHub App or account integration is an account-level action; repository source cleanup alone cannot revoke that authorization.

## Verification gate

Before calling a release live, verify the exact commit, workflow result, Pages deployment result, and public routes. If any one is missing, report the release as unverified rather than inferring success.
