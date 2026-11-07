# Mirror Cartographer
### The House of Mouths

> A word is a room.  
> A question is a door.  
> What is missing may matter most.

**Canonical public experience — GitHub Pages:** [Enter the House of Mouths](https://mirrorcartographer.github.io/mirror-cartographer-ui/) · [The Living Country](https://mirrorcartographer.github.io/mirror-cartographer-ui/?view=workshop&lane=country)

**Source / live-design workbench:** [Open the interactive workbench](https://mirrorcartographer.github.io/mirror-cartographer-ui/workbench.html) · 96 HTML artifacts with editable source and a live preview.  

**More rooms on the same public site:** [The House](https://mirrorcartographer.github.io/mirror-cartographer-ui/) · [Living Atlas](https://mirrorcartographer.github.io/mirror-cartographer-ui/atlas/) · [Research Atlas](https://mirrorcartographer.github.io/mirror-cartographer-ui/research-atlas/) · [Self Cartographer](https://mirrorcartographer.github.io/mirror-cartographer-ui/self/) · [Image Organism](https://mirrorcartographer.github.io/mirror-cartographer-ui/art-machine/)

## What is this place?

A question enters. It changes shape.

Mirror Cartographer is an experimental world for finding patterns, testing interpretations, making things, and noticing what a neat answer leaves out.

The encounter lives here: rooms, instruments, strange language, visual experiments, and paths between them.

The research and systems work lives in the [other repository](https://github.com/MirrorCartographer/MirrorCartographer).

## Find a door

- **[Creation Portal v1](https://mirrorcartographer.github.io/mirror-cartographer-ui/creation-portal-v1.html)** — recovered local-first art/animation/archive prototype; historical source is preserved in the research repository.

- **[Unified Execution Hub](https://mirrorcartographer.github.io/mirror-cartographer-ui/execution-hub.html)** — local-first lane status, evidence links, task updates, and JSON import/export. State stays in this browser until exported.


- **[Playable HTML Index](https://mirrorcartographer.github.io/mirror-cartographer-ui/atlas/interactive-index.html)** — direct links to interactive HTML experiences, grouped by area. Link targets are routes, not code views; live behavior still needs browser verification.

- **[Field Instruments](https://mirrorcartographer.github.io/mirror-cartographer-ui/field-instruments/)** — four distinct instruments for symbolic mapping, the 101-dimension atlas, consensus pressure, missing evidence, and veteran pathways.

- **[Project completion map](PROJECT_COMPLETION_MAP.md)** — verified status, acceptance criteria, and remaining work.
- **[The House of Mouths field guide](HOUSE_OF_MOUTHS_FIELD_GUIDE.md)** — the rooms, their rules, and how to wander.
- **[Field Guide to the Living Language](FIELD_GUIDE_TO_THE_LIVING_LANGUAGE.md)** — give a sensation a name; see what the name makes possible.
- **[LYR — The Unfinished Door](LYR_THE_UNFINISHED_DOOR.md)** — an offline journey through five strange territories.
- **[Self Cartographer](public/self/index.html)** — map body, attention, surroundings, relationships, values, and action. Your map stays local.
- **[The Body Is the First Archive](THE_BODY_IS_THE_FIRST_ARCHIVE.md)** — investigate what an encounter changes, without taking authorship away from the person.
- **[Obsession Map](OBSESSION_MAP.md)** — follow the threads.
- **[Cabinet of Real Things](CABINET_OF_REAL_THINGS.md)** — what exists, what is in progress, and what is still only a promise.

## The instruments

| Door | Try this |
|---|---|
| **The House** | Enter a sensory-first encounter. |
| **Living Atlas** | Wander between worlds, works, and archive paths. |
| **Research Atlas** | Trace relationships between claims, evidence, and open questions. |
| **Self Cartographer** | Make a private map of an unfolding state. |
| **Image Organism** | Grow, disturb, and recombine procedural specimens. |

## Under the floorboards

- [Mind](mind/) — memory, continuity, questions, decisions, hypotheses, failures.
- [Independent creative web](independent-creative-web/) — standalone works.
- [Media](media/) — sound and image experiments.
- [Research atlas](research-atlas/) — source-linked relationship instruments.
- [Operations](operations/) — build and recovery notes.
- [Tests](tests/) — checks against what the software actually does.
- [Source autobiography](source-autobiography.html) — a crafted narrative, not an independent factual record.

## Hosting and release authority\n\nGitHub Pages is the sole supported public publishing path for this repository. The source, build checks, route validation, and release identity remain in GitHub. No external hosting provider is required. Historical provider-specific evidence is retained only where needed to explain past engineering decisions; it is not an active deployment path. See [hosting policy](HOSTING.md).\n\n## Run it

```bash
npm ci
npm run catalog:build
npm run dev
```

For a production-style preview:

```bash
npm run build:pages
npm run preview
```

GitHub Pages uses the base path `/mirror-cartographer-ui/`. The catalog builder refreshes public repository manifests, applies privacy exclusions, checks provenance, and validates local routes and assets.

## The rules of the mirror

- Fact is not interpretation. Interpretation is not proof.
- A connection is not causation.
- A hypothesis is not a finding.
- No invented diagnosis. No promised cure.
- Private conversations, health records, financial details, and credentials do not belong in public commits.
- If an interface fails, repair it. Do not call the failure mysterious.

---

**The House keeps the question moving.  
The Observatory keeps the answer honest.**

[Find the research behind the mirror →](https://github.com/MirrorCartographer/MirrorCartographer)
