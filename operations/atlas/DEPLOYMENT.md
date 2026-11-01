# Living Atlas deployment and independence contract

## Approved public hosting

The only approved public hosting target is free GitHub Pages. Do not deploy this application to Vercel, Netlify, Cloudflare, or a paid host.

- Room-World: https://mirrorcartographer.github.io/mirror-cartographer-ui/
- Living Atlas: https://mirrorcartographer.github.io/mirror-cartographer-ui/atlas/
- The Between: https://mirrorcartographer.github.io/mirror-cartographer-ui/research-atlas/

These are the intended public URLs. A URL is not considered live until the GitHub Pages deployment succeeds and the browser checks below pass.

## Route contract

- `/` — wordless Room-World, mounted by `src/main.jsx` through `src/components/RoomWorldValid.jsx`. The interactive canvas control is `button.world-surface`; a user gesture changes the room field and may start locally generated sound.
- `/atlas/` — navigable Living Atlas in `public/atlas/index.html`, with six local world routes, experience/art/systems/archive sections, repository catalog, and a doorway to The Between. The Ten Experiments collection links to the ten original static routes published by the core repository at `/experiments/001-observatory/` through `/experiments/010-composer/`.
- `/research-atlas/` — The Between relationship instrument, sourced from `research-atlas/index.html` and mirrored to `public/research-atlas/index.html`.

The static routes do not require a backend or API key. The Pages build must emit `dist/index.html`, `dist/atlas/index.html`, `dist/research-atlas/index.html`, and the immutable deployment-identity manifest.

## Build and verification

- `npm run build:pages` builds the static Vite application with the `/mirror-cartographer-ui/` project path.
- `.github/workflows/publish-github-pages.yml` builds the three routes and deployment identity, uploads the Pages artifact, then deploys it.
- `scripts/generate-atlas-catalog.mjs` regenerates both repository manifests from current Git trees at build time. Private/credential-like paths and key-store file types are excluded; each manifest records its source commit and tree SHA.
- `scripts/validate-atlas-catalog.mjs` rejects excluded paths, duplicate entries, stale provenance, and mismatched counts.
- `scripts/validate-atlas-routes.mjs` resolves local HTML/CSS references, checks the six local mirror targets and ten core experiment routes, and rejects retired Vercel/Netlify/Pages.dev links.
- `.github/workflows/pages-preview.yml` runs the catalog generator and validators before its HTML/JavaScript checks.
- `.github/workflows/verify-live-atlas.yml` checks the deployed Atlas, six local worlds, The Between, health probe, and catalog manifests.
- `npm run test:remote-gate` checks the approved public URL and runs the live Room-World browser test after deployment.

The live Room-World test must target the active `button.world-surface` control. The retired `button.sky` selector belonged to an earlier interface and does not exist in the current active component. `scripts/live-wiring-check.mjs` now guards this contract.

## Current verification — 2026-11-01

Source commit: [d5f09fe3314893d51e982f5def6d2d4e4d63300c](https://github.com/MirrorCartographer/mirror-cartographer-ui/commit/d5f09fe3314893d51e982f5def6d2d4e4d63300c).

- [Publish run 41355797665](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41355797665): the Vite build, all three route artifacts, deployment identity, and Pages artifact upload passed. The deploy job failed at `actions/configure-pages@v5` with `Get Pages site failed: Not Found`; `actions/deploy-pages@v4` was skipped.
- Repository metadata reports `has_pages: false`. The Pages site has not yet been enabled for this repository.
- [Phone-first local smoke run 41355797560](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41355797560), [static preview artifact run 41355797636](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41355797636), and [working-machine run 41355797606](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41355797606) passed. These verify source/build behavior, not a public deployment.
- The live route and browser checks have not been run against a verified Pages deployment.

## Required one-time activation

A repository administrator must open [this repository's Pages settings](https://github.com/MirrorCartographer/mirror-cartographer-ui/settings/pages) and set **Build and deployment → Source → GitHub Actions**. Then rerun the publication workflow.

The workflow intentionally does not set `enablement: true`: that asks the workflow token to create the Pages site, an administrative operation the repository-scoped `GITHUB_TOKEN` cannot perform. Do not add a personal access token or another hosting provider to work around this setting.

After activation, require all of the following before describing the application as live:

1. The publication workflow's build and deploy jobs both pass for the same commit.
2. The root, `/atlas/`, and `/research-atlas/` routes open on desktop and phone.
3. The live Room-World test confirms canvas animation and painted pixels, the first user gesture, audio-context gating, immutable build identity, and no browser console errors.
4. The Atlas route test confirms all six local worlds, The Between, the health probe, and catalog manifests.

## Legacy provider history — not a release target

The repository previously used a Vercel-hosted Atlas at `https://mirror-cartographer-ui-3orp.vercel.app/atlas/`. Its catch-all rewrite was adjusted to preserve the `/atlas` route, and earlier live tests checked the six local experiences and health probe. That deployment record is historical; it does not establish the current public host or current availability.

`vercel.json`, `netlify.toml`, and `wrangler.jsonc` remain as historical or research material. They are not part of the approved public release path. Do not dispatch provider-specific deployment workflows.

## Independence and provenance

The Atlas is a navigable public interface over source material that remains in the two GitHub repositories. It is not a byte-complete independent archive or a backup of the repositories. Do not claim that all source files have been migrated to independent storage. The current hosting constraint is free GitHub Pages only.

Preserve repository, source path, source commit/tree identity when available, file hash when available, import time, authorship, licensing, and reuse boundaries for mirrored artifacts. Never replace provenance with a filename-only index or silently discard source attribution.
