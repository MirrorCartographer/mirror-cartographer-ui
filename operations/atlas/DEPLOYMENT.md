# Living Atlas: deployment contract

## Purpose

The Living Atlas is a standalone static website sourced from `public/atlas/`. It is intentionally deployable without installing the full Mirror Cartographer application dependencies. This avoids coupling a simple HTML publication to the UI's missing npm lockfile and broad test/build graph.

## Canonical publication

- Provider: GitHub Pages
- Source directory: `public/atlas/`
- Entry document: `public/atlas/index.html`
- Canonical project URL: `https://mirrorcartographer.github.io/mirror-cartographer-ui/`
- Workflow: `.github/workflows/deploy-github-pages.yml`

The publication artifact contains the contents of `public/atlas/` at the website root. Therefore the canonical URL is the repository Pages root, not `/atlas/`.

## Automated release gates

1. Validate that the entry document exists and contains required navigation, search, and content sections.
2. Upload the standalone directory as the Pages artifact.
3. Deploy through GitHub Pages.
4. Fetch the returned HTTPS URL and assert an HTTP success response plus expected page markers.
5. Record the exact workflow run and commit SHA as deployment evidence.

The separate `.github/workflows/pages-preview.yml` performs source-only checks and must not publish a competing artifact to the production Pages environment.

## Root cause recorded 2026-10-21

The prior Pages workflows used `actions/setup-node` with `cache: npm`, which requires a dependency lockfile. This repository has no `package-lock.json`; setup-node failed with “Dependencies lock file is not found” before install, build, or deploy steps could execute. The original Pages workflow also used `npm ci`, which is incompatible with the absent lockfile. The standalone site avoids both failure modes.

## Manual verification

- Open the canonical URL above.
- Confirm the title “Mirror Cartographer — The Living Atlas”.
- Use the navigation anchors for Experiences, Art & play, Systems, and Archive.
- Type a term such as “veterans” into the archive search and confirm the cards filter.
- Inspect the workflow's “Verify published page over HTTPS” step for a PASS result.

## Scope and provenance

The atlas is an index, not a claim that all assets have been copied into one bundle. Each project remains at its original source or deployed experience until a later repository-backed asset catalog imports it explicitly. Preserve source links and authorship/provenance while consolidating.
