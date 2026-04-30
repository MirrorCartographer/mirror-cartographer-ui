# TikTok Content Organizer Protocol

## Voice-readable summary

Creator is metadata. Content is the organizing layer.

A TikTok saved-video organizer must not pretend that raw links reveal meaning. A raw link alone should be marked `Needs Content Review` until it has caption, hashtags, visible text, transcript, audio description, or a manual note.

## Correct unit of organization

Use content evidence, not creator identity.

Primary evidence:
- caption
- hashtags
- visible text
- manual notes
- transcript when available and allowed
- audio/music label when available and allowed
- user-added category notes

Secondary evidence:
- creator name
- creator niche
- posting account context

Creator metadata can help disambiguate, but it must not determine the category by itself.

## Required statuses

- `Needs Content Review`: raw link or insufficient content evidence.
- `Categorized`: enough caption/text/note evidence to assign category.
- `Ambiguous`: multiple categories fit.
- `Manual Priority`: user marked this for human review.
- `Exported`: record has been exported to CSV or JSON.

## Built-in content categories

Initial rule families may include:
- coffee
- food
- art
- music
- fashion
- thrift
- places
- beaches
- cities
- states
- books
- film
- animals
- tools
- health
- home
- travel
- comedy
- emotional signal
- Mirror Cartographer relevance

## Correct workflow

1. Collect URL plus content evidence.
2. If only URL exists, mark `Needs Content Review`.
3. Sort by caption, hashtags, visible text, and manual notes.
4. Allow user-defined rules.
5. Export CSV and JSON.
6. Preserve original raw data.
7. Keep manual override fields.

## Hard limit

Links alone cannot reveal content reliably.

Do not fake categories from links alone.

## Proof rule

Organizer claims must state what data layer was available:

- raw links only
- links plus captions
- links plus visible text
- links plus manual notes
- full structured export

## Safety/platform boundary

Use platform-allowed export, manual collection, browser-visible text capture, or user-provided data.

Do not bypass TikTok access controls, scrape private data, evade platform protections, or use credentials in unsafe ways.

## Core phrase

Do not sort by who posted it. Sort by what the video is about.
