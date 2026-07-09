# Self-Branching Composer

## Current branch decision

The strongest move is testing/deployment confidence, not a new visible composition layer.

Vercel remains the primary atmospheric instrument. GitHub Pages is useful as a plain, reproducible gallery/fallback route, but only if it can be tested with the same phone-first constraints as the main app. The repo now exposes a named `npm run test:pages-preview` script so Pages builds are not hidden inside workflow YAML.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight

## Next suggested action

Add a remote/public URL probe for GitHub Pages that checks the Pages URL after deployment and fails clearly when the app shell is missing, the canvas is not present, or the route is serving a 404. Prefer extending the existing preview/remote gate scripts rather than adding another host.

If the Pages URL is not enabled yet, document the exact manual GitHub setting needed and keep Vercel as the primary public atmosphere.

## Later branch

Once public route confidence is stable, return to audio-visual coupling: make the visual score expose the same phrase phase, pulse, and weather density that the audio engine is hearing, without adding visible explanatory text.
