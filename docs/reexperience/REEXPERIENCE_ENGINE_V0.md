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

## Suggested next action

Create a seed JSON file with the first verified story beats from available Library search, then add a script that validates story-beat shape without requiring the full private chat export yet.
