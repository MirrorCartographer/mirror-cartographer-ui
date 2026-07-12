# The Weather Inside a Matchbox

## Creative premise

A hand-drawn interactive object contains a tiny impossible climate. Opening, dragging, or asking for a new forecast changes the micro-weather and its sentence. Sound is optional and generated locally after explicit user activation.

## Independence boundary

This piece is deliberately not:

- a Mirror Cartographer explainer;
- a research portal;
- a continuity dashboard;
- a product or conversion funnel;
- a health, diagnosis, or treatment surface;
- a payment surface.

It has no dependency on the Mirror Cartographer application, data, accounts, APIs, personal records, or brand language. It is a self-contained static artwork that can be hosted anywhere that serves one HTML file.

## Interaction contract

- Click/tap or Space/Enter opens and closes the matchbox.
- Horizontal drag opens it and changes the forecast.
- “New forecast” opens the box if needed and generates another impossible forecast.
- Sound starts only after explicit activation and uses Web Audio oscillators; no media is fetched.
- The caption uses `aria-live="polite"`.
- Reduced-motion preferences collapse animation durations.
- Mobile safe-area insets and `100svh` are supported.

## Rollback

Revert the commits that add this directory. No shared application file, deployment configuration, payment path, or repository history needs deletion.
