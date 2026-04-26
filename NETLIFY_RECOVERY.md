# Netlify Recovery Notes

## Current build shape

This repo is now a clean Vite/React portal.

Required Netlify settings:

```txt
Build command: npm run build
Publish directory: dist
Branch: main
```

## Fixed issue

Netlify previously failed during repo preparation because the Git tree contained a broken submodule/gitlink:

```txt
mirror-cartographer-next
```

The clean commit removed these problem paths from `main`:

```txt
mirror-cartographer-next
.gitmodules
package-lock.json
```

Clean commit:

```txt
baa2fde7cf3392a26a1d02aa985b3d5614cd1034
```

## If Netlify still fails during preparing repo

Run:

```txt
Clear cache and deploy site
```

If the same submodule error appears after the clean commit, Netlify is using cached checkout state. Clear cache is required because the failure happens before the normal build step.

## If Netlify fails during install/build

Check that the repo is using:

```txt
npm install --package-lock=false --no-audit --no-fund
npm run build
```

The portal intentionally does not use Next.js or a package lock.

## Current fallback

Vercel deployment is already successful from the clean commit. Netlify is a secondary deployment path.
