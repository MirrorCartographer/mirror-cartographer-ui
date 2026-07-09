# Composition capability cycle — 2026-07-09 phrase memory

## Read first

Current next-action source: `docs/cycles/2026-07-09-frame-wiring-cycle.md`.

That note says to run gates before more composition work, then add phrase memory only if clean. Available repository evidence shows:

- `scripts/run-phone-gates.mjs` exists and runs the phone contract plus production build;
- `src/engine/compositionClock.js` exists;
- `src/engine/compositionFrame.js` exists;
- `src/components/App.jsx` wires the frame projector into the tap path and the low-frequency tick;
- `scripts/phone-contract-check.mjs` guards no autoplay, tap-to-start, wordless UI, mobile smoke shape, clock wiring, and frame wiring.

## Evaluation

Strongest current need: phrase memory, but only as an engine-only primitive.

Reason for branching: the local/static gate command cannot be executed by the current GitHub connector, and the public Vercel URL still cannot be opened by the web tool unless it appears in current search results or the current user message. Search returned no public result for the deployment URL. Because browser/live verification is unavailable in this run, wiring phrase memory into the app would be too large a behavioral change.

Priority order after this cycle:

1. run gates from a real shell or CI-capable environment;
2. wire phrase memory into the existing composition frame path only if gates pass;
3. use memory contour to alter visual score motion subtly;
4. add counterpoint later;
5. defer hosting migration.

## Host/repo verdict

Keep Vercel as primary. The host is not the current blocker; test visibility is. Repository iteration is helping: both source and contract writes succeeded. Cloudflare Pages remains the best later parallel confidence host if Vercel preview visibility stays opaque, but switching now would add churn before the phone contract and smoke path are executed. Netlify and GitHub Pages do not improve the current bottleneck enough to justify migration.

## View/test route

The concrete available test route remains:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`
3. live/preview smoke only when a reachable preview URL is available to the browser tool or CI logs

## Implementation result

Smallest feasible GitHub change:

- added `src/engine/phraseMemory.js`;
- added static contract checks for phrase memory.

The primitive stores the last few composition frames as numeric contour data: beat, phase, phrase, energy, rhythm, and state. It has no browser globals, no audio start path, no UI text, no new visible controls, and no new instrument.

## Next suggested action

Run gates:

1. `node scripts/run-phone-gates.mjs`
2. `npm run test:smoke`

If clean, wire `createPhraseMemory` into `App.jsx` behind refs only:

- create `phraseMemoryRef` with `createPhraseMemory()`;
- call `remember(composition)` after tap frames and interval frames;
- pass only `phraseMemoryRef.current.contour()` into `useWordlessSky`;
- use contour for a tiny visual score drift, not new text, not autoplay, not another instrument.

If gates fail, repair the failing gate before any creative layer.
