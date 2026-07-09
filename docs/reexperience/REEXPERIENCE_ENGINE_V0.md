# Re-experience engine v0

Purpose: turn prior Mirror Cartographer chats, notes, screenshots, docs, and generated artifacts into a chronological felt-story system.

This is not a normal archive. The site should not ask the visitor to read a database. It should let Charity re-enter the history as a living sequence: first signals, wrong turns, motifs, corrections, animals, body, weather, music, proof, anger, jokes, failures, and recoveries.

## Current verified source seeds

From available Library search, not from assumption:

- Continuity export names the live prototype as `https://mirror-cartographer-ui.vercel.app` and names the repos `MirrorCartographer/mirror-cartographer-ui` and `MirrorCartographer/MirrorCartographer`.
- Continuity export preserves the accessibility rule: do not put essential content in code boxes.
- Prior chat log preserves the core non-boring/world-worth-inhabiting signal.
- Prior chat log preserves the phrase: not a platform, not an app, but a recursive symbolic field protocol.
- Prior chat log preserves the re-enchantment direction: thread a living symbolic layer through existing systems.
- Prior chat log preserves an earlier loop process: pick one signal, run collapse, name what survives, build a gesture around it, anchor it in the real world, repeat.

## What must be built

### 1. Ingest

Inputs may include:

- ChatGPT export JSON
- copied chat text
- RTF logs
- DOCX/PDF preservation packets
- screenshots/photos
- GitHub docs and commit notes
- user notes from phone/computer

The first version can accept plain text files and manually curated JSON. Later versions can parse full ChatGPT export JSON.

### 2. Segment

Every source should become small story beats:

- timestamp when known
- speaker/source
- exact excerpt or summary
- signal tags
- feeling tags
- proof status
- privacy status
- motifs
- build consequence

### 3. First-time reading pass

The engine should simulate a first reading pass by asking, for each beat:

- What did I just learn?
- What surprised me?
- What changed the project direction?
- What motif appeared or returned?
- What should future-me not forget?
- What should the site make Charity feel here?

This is not private chain-of-thought. It is an explicit note-taking artifact.

### 4. Felt-story transform

The website should not display a wall of text. Text can exist in the archive, but the phone-first experience should translate beats into:

- weather state
- motion density
- sound palette
- heart/field behavior
- return motifs
- pauses
- intensities
- hidden doors

The key interaction is not tap. Tap only unlocks browser audio. The real interaction is: user feels, site answers with atmosphere.

### 5. Privacy boundary

Raw chats stay private unless reviewed. Public preview should use redacted/capsule beats.

## Minimal data shape

Each beat should be representable as:

- `id`
- `order`
- `source`
- `time`
- `excerpt`
- `capsule`
- `signals`
- `motifs`
- `feltWeather`
- `musicHint`
- `proofStatus`
- `privacy`
- `firstPassNote`
- `siteGesture`

## Site direction

The current site is visually pleasant but does not yet answer why someone stays. The next real creative direction is not more particles. It is narrative gravity.

A return visitor should feel that the site is slowly remembering how it became itself.

## Build-cycle status

The first seed JSON and validation script now exist. The app now imports `src/data/reexperience.seed.json` and turns recent story beats into subtle hidden weather marks, thread-lines, heart gravity, and glyph structure. This preserves the wordless surface: no visible explanatory text was added, audio still starts only from user tap, and the change reuses the existing canvas loop rather than adding a second renderer.

## Hosting/testing assessment

Current best default host: Vercel, because the continuity anchor already names the live prototype there and the repo is a Vite/React static site with no backend requirement. Switching hosts now would add operational noise without solving the immediate product problem.

Safer branching path: for visual rewrites or risky audio changes, use a preview branch before `main`. For small data/render coupling changes like this cycle, `main` is acceptable if the local gate passes.

Fallback hosts:

- Cloudflare Pages: strongest alternate static host if Vercel preview reliability becomes poor.
- Netlify: good alternate for manual static deploys and simple previews.
- GitHub Pages: lowest-moving-parts fallback, but less ideal for phone-first preview iteration and branch preview ergonomics.

Known testing gap: this run could inspect repo content and write changes, but the public URL fetch/screenshot path was inconclusive from available tools. The repo needs a lightweight deterministic test that proves the app imports the story seed and can render one frame without relying on the hosted site.

## Suggested next action

Add a small Playwright or Node-based harness that visits the local Vite preview, asserts the canvas exists, taps once to satisfy audio unlock policy, and checks that the app stays alive for several animation frames on a phone-sized viewport. After that passes, tune the story-beat influence so each beat affects composition/audio more distinctly without adding words.
