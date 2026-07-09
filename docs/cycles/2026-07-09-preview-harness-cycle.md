# Self-directed build cycle — preview candidate harness

Date: 2026-07-09

## Latest suggested action inspected

The latest cycle note said to run:

- `SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:preview-url`
- then `SITE_URL=<passing-url> npm run test:live`
- then, only if both pass, wire `phraseMemory` into the mark/composition flow.

## Decision

I revised the next action instead of adding `phraseMemory`.

Reason: the multi-host preview candidate checker was newly added, but there was no local harness proving its candidate fallback behavior. Adding feeling/phrase behavior before proving the preview gate itself would compound uncertainty.

## Hosting / testing assessment

- Vercel remains useful as the default production/stable host, but this run observed Vercel status as pending on the final package wiring commit.
- Cloudflare Pages remains the strongest parallel preview lane because the app is a static Vite build and should be portable after relative asset-base work.
- Netlify remains a reasonable fallback if Cloudflare setup is blocked.
- GitHub Pages is now more plausible than before because assets are relative, but it is still lower priority due to base-path and private-repo workflow considerations.
- A separate repository is not justified yet; small reliability patches are safe in the current repo. Use a branch for larger creative or architecture changes.

## Implemented change

Added `scripts/preview-url-check.unit.mjs`.

It starts local HTTP servers and verifies:

- a blocked/limit-like candidate can fail while a later valid candidate passes,
- a blocked single candidate fails,
- an invalid URL candidate fails.

Updated `package.json`:

- added `test:preview-url:unit`,
- inserted it into `test:remote-gate` before the real remote URL check.

## Verified

- Latest commit before this cycle: `Record preview candidate cycle`.
- The existing preview checker supports comma-separated `SITE_URLS`.
- The app shell currently remains wordless in the React return path.
- Audio still starts only from pointer interaction through the `touch` handler.
- Vercel status for `ea97dd1` was pending when checked.

## Inferred

- Cloudflare Pages is the best second preview lane because the build is static and host-independent reliability is currently more valuable than new behavior.
- The preview harness should catch the exact regression class introduced by multi-candidate routing.

## Unverified

- The harness has been committed but not observed running in CI from this tool session.
- The live Vercel URL could not be fetched through the available public web path in this run.
- No Cloudflare Pages URL is configured or known yet.
- Live browser/screenshot proof remains missing.

## Next suggested action

Run:

`npm run test:preview-url:unit`

Then run:

`SITE_URLS=https://mirror-cartographer-ui.vercel.app,https://<cloudflare-pages-url> npm run test:preview-url`

If a URL passes, run:

`SITE_URL=<passing-url> npm run test:live`

Only after that, wire a tiny `phraseMemory` layer into marks/composition with no visible explanatory words, no autoplay, no new scheduler, and no higher CPU budget.
