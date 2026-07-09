# Composer cycle note

The strongest next move remains test visibility first, then a shared composition clock.

Assessment:

- Playback repair: not selected. Tap-to-start already has a smoke contract, but no confirmed run result yet.
- Composition structure: selected as the next composer branch after smoke execution.
- Phrase memory: already present in the music engine.
- Counterpoint: already present enough for now.
- Weather mapping: present, but should later be routed through a shared timing object.
- Audio-visual coupling: underbuilt. This is why the composition clock matters.
- Hosting: keep Vercel. Changing hosts now would not solve the missing test-result problem.
- Alternate hosts: Cloudflare Pages remains the best parallel candidate later. Netlify is acceptable but not stronger. GitHub Pages is not the right primary surface.

Smallest safe next action:

Add a pure composition clock module that derives phrase, section, beat, cadence, lift, and answer state from the current step and weather snapshot. Do not change audible behavior in the first integration. Then add a small unit or static test for phrase boundaries.

Why not add another instrument now:

The music engine is already dense. More voices would increase risk before the app has confirmed mobile smoke results.
