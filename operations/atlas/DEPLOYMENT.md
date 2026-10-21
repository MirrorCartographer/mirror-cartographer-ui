# Living Atlas: deployment contract

## Purpose

The Living Atlas is a standalone static website sourced from `public/atlas/`. It is intentionally deployable without installing the full Mirror Cartographer application dependencies.

## Canonical publication

- Provider: Vercel
- Public entry route: `https://mirror-cartographer-ui.vercel.app/atlas/`
- Source entry document: `public/atlas/index.html`
- Static health probe: `public/atlas/healthz.txt`
- Route configuration: `vercel.json`
- Live smoke test: `.github/workflows/verify-live-atlas.yml`

Vercel's prior catch-all rewrite sent almost every path to the application `/index.html`. The rewrite now excludes `/atlas` and its descendants so Vercel can serve the static atlas and its health probe.

## Automated release gates

1. Validate that the standalone HTML entry exists and contains the expected navigation, search, and content sections.
2. Deploy the repository through its existing Vercel Git integration.
3. Fetch the public HTTPS route and verify the HTML response and expected page markers.
4. Fetch `/atlas/healthz.txt` and verify the static health response.
5. Record the exact Git commit and workflow run used as evidence.

The workflow `.github/workflows/deploy-github-pages.yml` is source validation only. GitHub Pages is not enabled for this repository; attempts to enable it from Actions failed because the workflow token lacks permission to create the Pages site. Do not claim GitHub Pages deployment until an administrator enables it in repository settings.

## Root causes recorded 2026-10-21

- The earlier GitHub Pages workflows used `actions/setup-node` with `cache: npm`, which requires a dependency lockfile. The repository has no `package-lock.json`; setup failed before installation or deployment. The standalone atlas avoids the full npm build.
- GitHub Pages was not enabled for the repository, and the workflow token could not enable it.
- Vercel's catch-all SPA rewrite intercepted `/atlas/`; the rewrite now explicitly excludes the atlas route.
- The first live-smoke workflow had a malformed regular expression in its URL candidate builder. It was corrected to use `endsWith('/')`, bounded request timeouts, and a separate health probe.

## Manual verification

- Open `https://mirror-cartographer-ui.vercel.app/atlas/`.
- Confirm the title “Mirror Cartographer — The Living Atlas”.
- Use the navigation anchors for Experiences, Art & play, Systems, and Archive.
- Type a term such as “veterans” into archive search and confirm the cards filter.
- Open `https://mirror-cartographer-ui.vercel.app/atlas/healthz.txt`; the response should include `status=ok` and `service=mirror-cartographer-living-atlas`.
- Review the live-smoke workflow for its explicit PASS output.

## Scope and provenance

The atlas is an index, not a claim that all assets have been copied into one bundle. Each project remains at its original source or deployed experience until a later repository-backed asset catalog imports it explicitly. Preserve source links and authorship/provenance while consolidating.
