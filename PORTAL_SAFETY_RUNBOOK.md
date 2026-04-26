# Mirror Portal Safety Runbook

This portal is now a connected live system:

```txt
ChatGPT -> GitHub main branch -> Vercel deploy -> live site
```

## Operating rule

Assume every update can fail.

Therefore:

1. Prefer data-feed updates over core-app rewrites.
2. One small commit at a time.
3. Check Vercel status after each commit.
4. If a deploy fails, stop feature work and patch the failure first.
5. Do not make rapid visual/code edits without confirming the last deploy succeeded.

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
- Vercel detecting the wrong framework
- import path typo
- JSX syntax error
- unsupported package/dependency change

Current mitigations:

- `vercel.json` explicitly sets Vite framework, install command, build command, output directory
- `.npmrc` disables package-lock usage
- `netlify.toml` exists for Netlify fallback
- app is wrapped in `ErrorBoundary`

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

If live site fails:

1. Check latest commit deploy status.
2. If failure: inspect Vercel logs.
3. If blank page but deploy succeeded: use portal recovery screen or clear local storage.
4. If main app is broken: revert latest core-app commit or patch import/syntax error.
5. If build config breaks: restore known-good Vercel config.

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
