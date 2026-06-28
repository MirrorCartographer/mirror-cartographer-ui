# Mirror Cartographer iCloud Artist Gallery Bridge

Purpose: create a practical path from an iCloud shared photo album into the Mirror Cartographer Vercel site without pretending the site has hidden access to Apple account data.

## Source

The current source is an iCloud shared album link supplied by Charity.

Because iCloud shared albums are not a stable public API feed for this project, the reliable bridge is user-authorized import:

1. Open the shared album in the browser.
2. Select or download the images that belong in the artist gallery.
3. Add the images to a permanent asset location.
4. Create a gallery manifest that maps each image into the Mirror Cartographer system.
5. Render the manifest on Vercel as an artist gallery with graph axes.

## Gallery manifest shape

Each artwork should become one node:

- id
- title
- artist or source
- type
- image path
- mood
- symbolic tags
- palette
- weather axes
  - charge
  - tide
  - static
  - bloom
- notes
- related artwork ids

Example:

```json
{
  "schema": "mirror-cartographer.artists.v1",
  "items": [
    {
      "id": "artwork-001",
      "title": "Untitled portal image",
      "artist": "Charity Alessandra Sturgell",
      "type": "image",
      "image": "/artists/artwork-001.jpg",
      "mood": "private, luminous, unresolved",
      "tags": ["portal", "weather", "signal"],
      "palette": ["#ff4f9a", "#67e8f9", "#fde68a", "#020617"],
      "weather": {
        "charge": 72,
        "tide": 66,
        "static": 58,
        "bloom": 84
      },
      "notes": "Imported from the iCloud source album after user selection.",
      "related": []
    }
  ]
}
```

## Vercel gallery behavior

The gallery should include:

- phone-first image grid
- large featured artwork view
- per-artwork weather graph bars
- constellation relationship view
- filter by tag, mood, type, or intensity
- graph summary of the whole collection
- explicit source/provenance field

## Implementation route

Recommended files:

- `public/artists/` for published artwork images
- `src/data/artistGallery.js` for gallery manifest data
- `src/components/ArtistGallery.jsx` for the rendered gallery
- `src/assets/artist-gallery.css` for visual styling

## Why this route

Direct server-side ingestion from iCloud is not reliable in this environment because Apple shared photo pages do not behave like a normal open file bucket. The correct bridge is a user-authorized import step followed by permanent asset storage under the project.

This still gives the site the desired result: a living artist gallery with graphable symbolic metadata, while keeping the source path truthful and maintainable.
