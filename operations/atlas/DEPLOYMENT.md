# Living Atlas: deployment and independence contract

## Canonical site

- Public entry: https://mirror-cartographer-ui-3orp.vercel.app/atlas/
- Host: Vercel static deployment
- Entry source: `public/atlas/index.html`
- Local experience mirrors: `public/atlas/worlds/`
- Source catalog: `public/atlas/catalog-index.json`, `catalog-main.json`, `catalog-ui.json`
- Health probe: `public/atlas/healthz.txt`
- Live release gate: `.github/workflows/verify-live-atlas.yml`

## What is local now

The Atlas itself and six self-contained HTML experiences are served from the Vercel host: Night Shift Orchard, Afterimage Orchard, Constellation, The World, Research Field, and Ten Experiments. They open as same-site routes and do not require the visitor to navigate GitHub to enter them. The catalog points to those local copies when a source path has been mirrored; otherwise it retains the source link and provenance.

## Verification

The live smoke test checks the canonical HTTPS page, ten content/navigation markers, all six local experience routes, and `/atlas/healthz.txt`. A deployment is only described as verified when the workflow logs show a PASS result for the exact commit.

## Root causes and deployment history

- The previous Vercel catch-all rewrite sent nearly every path to the application `/index.html`; `vercel.json` now excludes `/atlas` and descendants.
- Earlier GitHub Pages workflows required a package lockfile that the repository did not contain. GitHub Pages was also not enabled and the workflow token lacked permission to enable it. Vercel is the currently verified public host.
- The first live-smoke workflow had a malformed URL expression. It was replaced with bounded requests, explicit candidate URLs, local-world route checks, and a health probe.

## Independence boundary

The public-facing experience is hosted by Vercel, not GitHub Pages. The six experiences listed above are mirrored into the Atlas site. The full repository archive is **not yet independent of GitHub**: the source manifests currently index 6,536 files, and most entries still link to their canonical repository source. Full migration requires a durable object store or self-hosted storage, bulk transfer of all file bytes (not just metadata), checksums and provenance records, a backup/restore process, and a host controlled by the project. Do not claim those files have been migrated until each stored byte is verified against its source checksum and a restore test passes.

## Preservation rules

Keep source repository, source path, commit/tree identity, file hash, import timestamp, and authorship metadata for each mirrored artifact. Never replace the source catalog with a filename-only index or silently discard original provenance.
