# Mirror Portal Safety Runbook

## Current release authority — 2026-11-01

The only approved public hosting target for this application is free GitHub Pages:

- Room-World: `https://mirrorcartographer.github.io/mirror-cartographer-ui/`
- Living Atlas: `https://mirrorcartographer.github.io/mirror-cartographer-ui/atlas/`
- The Between: `https://mirrorcartographer.github.io/mirror-cartographer-ui/research-atlas/`

Do not publish the application through Vercel, Netlify, Cloudflare, or paid hosting. Existing provider configuration and research files are retained as repository history, not as release instructions.

The root route is intentionally a wordless Room-World. The navigable Living Atlas is the separate `/atlas/` route; The Between is `/research-atlas/`.

## Operating rule

Assume every update can fail.

Therefore:

1. Prefer data-feed updates over core-app rewrites.
2. Make one small commit at a time.
3. Check the `Publish interactive application to GitHub Pages` Actions run after each commit.
4. Treat a successful build as artifact proof only; deployment is not complete until the deploy job succeeds.
5. If `configure-pages` or `deploy-pages` fails, stop release work and resolve the GitHub Pages setting before changing application code.
6. Do not claim the site is live until all three routes have been opened and checked on desktop and mobile.

## Safer update lanes

### Lowest risk

- Update `src/data/creationFeed.js`
- Add new artifact capsules
- Add new lyrics, prompt fragments, weather values, palette values
- Add docs/runbooks

### Medium risk

- Add small CSS files imported by `src/main.jsx`
- Add non-critical UI sections
- Add small components that do not affect the gate

### Higher risk

- Rewrite `src/components/App.jsx`
- Change build config
- Change install commands
- Change package/dependency versions

## Known failure modes

### Build failure

Most likely causes:

- stale `package-lock.json`
- import path typo
- JSX syntax error
- unsupported package/dependency change

Current mitigations:

- The GitHub Pages workflow runs `npm run build:pages` and verifies the root, `/atlas/`, and `/research-atlas/` artifacts before upload.
- `.npmrc` preserves the repository's existing npm install behavior.
- `netlify.toml` and `vercel.json` are legacy configuration only; neither is part of the approved Pages release path.
- The app is wrapped in `ErrorBoundary`.

### Runtime blank page

Most likely causes:

- corrupted localStorage
- browser blocks Web Audio
- canvas context unavailable
- bad capsule data

Current mitigations:

- Error boundary recovery screen
- localStorage safe read/write wrappers
- capsule sanitization
- audio failure notes
- reset local field button

### Visual degradation

Most likely causes:

- browser lacks CSS `color-mix`
- mobile viewport compression
- grid collapse on small screens

Current mitigations:

- CSS fallback for `color-mix`
- mobile media queries
- gate remains simple

## Recovery protocol

If a GitHub Pages route fails:

1. Open the latest `Publish interactive application to GitHub Pages` run and record its source commit.
2. If the build job fails, inspect the failing build step and fix that source or dependency issue first.
3. If the build succeeds but `configure-pages` fails, the repository owner must open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions** once.
4. If `deploy-pages` fails after configuration, inspect the deployment job and environment permissions; do not switch providers.
   - Earlier run [41351541475](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41351541475) used `enablement: true` and returned both `Get Pages site failed: Not Found` and `Create Pages site failed: Resource not accessible by integration`.
   - Latest run [41353483322](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41353483322) passed the Vite build, all three route artifacts, immutable build-identity check, and Pages artifact upload. `configure-pages` then returned `Get Pages site failed: Not Found`; `deploy-pages` was skipped. Repository metadata reports `has_pages: false`.
   - Local-gate run [41353244601](https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/41353244601) passed the contract suite, production build, and both Playwright smoke tests after the canvas assertion was changed to sample nine regions instead of one center pixel. This is local-build proof, not live-deployment proof.
   - Enable **Settings → Pages → Build and deployment → Source → GitHub Actions** once. Do not add a personal access token or switch hosting providers.
5. After a successful deploy, open the root, `/atlas/`, and `/research-atlas/` routes. Verify local world links, console errors, and phone layout.
6. If a route is blank despite a successful deploy, inspect its built HTML, relative asset paths, browser console, and local storage before reverting code.

The automatic push/pull-request smoke workflow runs the local gate only. Use **Run workflow** after a successful GitHub Pages deployment to run the live remote gate against the approved Pages URL.

The following config is retained only as a historical Vercel reference; do not restore it as the public deployment path.

Known-good config:

```json
{
  "framework": "vite",
  "installCommand": "npm install --package-lock=false --no-audit --no-fund",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

## Creative update protocol

New creations should usually enter as capsules:

```js
{
  id: 'unique-id',
  title: 'Title',
  type: 'song room | visual score | animation sketch | vlog weather | aftermath',
  mood: 'short emotional weather phrase',
  weather: { charge: 0-100, tide: 0-100, static: 0-100, bloom: 0-100 },
  phrase: 'one image-rich sentence',
  lyric: 'one lyric fragment',
  palette: ['#hex', '#hex', '#hex', '#hex'],
  notes: 'what this artifact is for'
}
```

This keeps the portal alive without destabilizing the whole app.
