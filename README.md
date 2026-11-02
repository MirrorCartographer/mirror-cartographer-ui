# Mirror Cartographer — The House of Mouths

> **A word is a room. A question is a door. A contradiction may be a compass.**

This repository contains the encounter side of Mirror Cartographer: interactive experiments, symbolic language, creative interfaces, prototypes, and small worlds for approaching a question from more than one angle.

The core repository, [MirrorCartographer](https://github.com/MirrorCartographer/MirrorCartographer), holds the research method, architecture, evidence, and systems work. This repository holds the places where those ideas can be explored through interaction, tone, form, and play.

## Start with the field guide

**[Read The House of Mouths field guide](HOUSE_OF_MOUTHS_FIELD_GUIDE.md).** It maps the main experiences, the syntax field, the coined vocabulary, and a way to explore without treating every file as a chore.
**[Follow the Obsession Map](OBSESSION_MAP.md).** It connects the existing rooms, language experiments, creative pieces, and continuity ideas into a set of trails.


**[Open the Cabinet of Real Things](CABINET_OF_REAL_THINGS.md).** See the creative pieces, research instruments, and production plans that already have a shape—and the difference between a plan and a finished experience.

## The three main encounters

| Experience | What it offers | Source |
|---|---|---|
| **Room-World** | A wordless, sensory-first interface experiment | `src/main.jsx`, `src/components/RoomWorldValid.jsx` |
| **Living Atlas** | A navigable set of worlds, creative work, systems, and archive paths | `public/atlas/index.html` |
| **The Between** | A relationship instrument for changing lenses and traversing connections | `research-atlas/index.html` |

The active application is a Vite project. `src/components/App.jsx` is an earlier prototype, not the active React entry point. The research-atlas source and built public copy are intended to remain identical.

## Explore by territory

- **[Mind](mind/)** — continuity, memory, hypotheses, questions, decisions, and failures.
- **[Independent creative web](independent-creative-web/)** — standalone works with their own atmosphere.
- **[Media](media/)** — sound and image experiments.
- **[Research atlas](research-atlas/)** — a source-linked relationship instrument.
- **[Operations](operations/)** — build, deployment, and recovery notes.
- **[Tests](tests/)** — checks that distinguish intended behavior from actual behavior.
- **[Source autobiography](source-autobiography.html)** — a creative artifact; read it as a crafted narrative, not an independent factual record.

## Run locally

```bash
npm ci
npm run catalog:build
npm run dev
```

For a production-style local preview:

```bash
npm ci
npm run catalog:build
npm run build:pages
npm run preview
```

The hosted project base path is `/mirror-cartographer-ui/`. Use `npm run build:pages` for the GitHub Pages build. The catalog builder refreshes public repository manifests, applies privacy exclusions, checks source provenance, and validates local routes and assets.

## Hosting status — 2026-11-01

The intended public routes are:

- Application: `/mirror-cartographer-ui/`
- Atlas: `/mirror-cartographer-ui/atlas/`
- The Between: `/mirror-cartographer-ui/research-atlas/`

**Do not treat those URLs as live until the deployment succeeds and the routes have been checked.** The latest recorded build and artifact upload passed, but the Pages configuration step failed because a Pages site had not yet been enabled. The remaining action and recovery steps are in [the deployment runbook](operations/atlas/DEPLOYMENT.md). This repository does not require Vercel, Netlify, Cloudflare, a server, or a paid host for the intended static GitHub Pages deployment.

## Integrity rules

- Preserve the distinction between fact, interpretation, hypothesis, and symbolic reading.
- A relationship drawn on a map is not proof of causation.
- Do not claim medical or veterinary diagnosis or a cure that has not been established.
- Keep raw private conversations, medical and veterinary records, financial details, credentials, and unreviewed personal material out of public commits.
- Keep accessibility and clear interaction paths in the work. An interface that fails is a failure to repair, not a metaphor to excuse it.
- Keep the art alive without letting the language obscure what the software actually does.

---

**The House keeps the question in motion. The Observatory keeps the answer accountable.**

[Open the research world →](https://github.com/MirrorCartographer/MirrorCartographer)
