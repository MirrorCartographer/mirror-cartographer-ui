# Suggested next action

## Reliability change completed

`useWordlessSky` now owns exactly one requestAnimationFrame handle:

- each callback clears the active RAF marker when entered
- a hidden document returns without scheduling another frame
- the visibility handler cancels and clears the active frame when hidden
- visibility restoration resizes and requests a frame only when no frame is active
- cleanup cancels the active frame and removes both listeners

Commit: `ce187cdeb40ef0b52577dfd9df2e9a30b9c036a8`

The change preserves tap-to-start, audio behavior, visible output, reduced-motion handling, and interaction semantics.

## Current best next move

Verify the deployed Vercel build and canonical static gate for commit `ce187cdeb40ef0b52577dfd9df2e9a30b9c036a8`, then add a runtime visibility-transition probe if deployment evidence cannot directly exercise repeated hide/show cycles.

## Why this is next

The source-level defect and contract mismatch are repaired, but reliability is not complete until the deployed artifact is shown to contain the fix and repeated visibility transitions are verified against duplicate-loop regression.

Current status evidence:

- GitHub accepted the source commit
- the repository's phone contract is shaped to reject hidden-tab rescheduling and require single-loop restart ownership
- Vercel status was pending immediately after the commit
- no pull-request-triggered Actions run was attached to the commit at first inspection

## Preserve

- no autoplay
- tap-to-start only
- no visible explanatory copy
- no audio changes
- no duplicate animation loops
- reduced-motion safety
- existing canvas output while visible
- Vercel atmosphere remains phone-first
- GitHub Pages remains the canonical static fallback while Vercel quota/status is ambiguous
- the Cloudflare-backed public repository remains the artist-field / reusable-state surface, not a duplicate atmosphere

## Verification route

Inspect or run:

- `npm run test:phone-contract`
- `npm run build`
- `npm run test:smoke`
- `npm run test:pages-preview`
- deployed-source or browser probe across at least three hidden/visible transitions

The visibility probe should assert:

1. no RAF is pending after the hidden callback settles
2. one RAF is pending after visibility restoration
3. repeated visible events do not create additional loops
4. cleanup leaves no RAF and no visibility listener

## Hosting topology

- `mirror-cartographer-ui` is the Vercel phone-first living encounter.
- `MirrorCartographer` is the public artist field and Cloudflare-capable static/edge surface.
- The two sites share encounter schemas and replay fixtures, but not interface or emotional role.

## Next capability after the reliability gate

Once deployed verification is green, wire the existing `fieldEncounter` selector into visual pressure only. Do not add visible explanatory text or audio coupling in that first integration.