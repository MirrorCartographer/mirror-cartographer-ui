# Self-Branching Composer

## Current branch decision

Revise the previous action rather than branching into composition. The restored wordless weather/music surface is the right product direction, but the latest documentation-only commit is blocked at Vercel by build-rate limits. Reliability now means treating the already-successful restored app commit as the last trusted public app state, using GitHub Pages as the active fallback verification route, and avoiding new visual/audio work until the gates can distinguish product regressions from host quota failures.

## Hosting assessment

Vercel remains the best primary host for the intended public atmospheric surface when builds are available, because its commit statuses give immediate deployment truth. It is not sufficient as the only gate while the project is hitting build-rate limits. GitHub Pages is now the strongest secondary surface because the repo already has a Pages workflow, a Pages build command, a static phone gate, and a post-deploy remote gate. Cloudflare Pages should be the next fallback only if GitHub Pages cannot reliably deploy or expose the built app. Netlify remains viable but lower priority because it adds another host before the existing Pages path is proven. A separate stable repo is still premature; a stable branch or gallery route is the better first split if experiments keep reaching `main`.

## Live/testing check

Vercel reported success for restored app commit `7f5b2c66f5461e8eaf533e8c0f04438fabd61edd`, which means the wordless recovery surface had a valid deploy status. The next commit `704ac562e749d98b55f40eb468766e8920ac08a5` failed Vercel with a build-rate-limit upgrade URL, so that failure is host quota, not proof that the app failed. The Pages workflow exists and includes `npm run test:pages-preview` before artifact upload plus a deployed-url verification step using `SITE_URL` from the Pages deployment output. The local/CI harness remains: `npm run test:phone-contract`, `npm run test:pages-preview`, and then the live `npm run test:pages-remote`/workflow remote gate.

## Preserved constraints

- no autoplay
- tap-to-start only
- wordless visual surface
- phone-first layout and performance
- efficient scheduling before extra composition weight
- host failures must not be misread as product failures

## Change made in this cycle

No composition code was changed. The smallest safe improvement was this gate record: it prevents the next run from misclassifying the latest Vercel failure as a broken app and makes GitHub Pages verification the active reliability branch while Vercel is rate-limited.

## Next suggested action

Verify the GitHub Pages path rather than adding features. Inspect the latest Pages workflow outcome or run the equivalent commands from a checkout/CI-capable environment: `npm run test:phone-contract`, `npm run test:pages-preview`, then `npm run test:pages-remote` against `https://mirrorcartographer.github.io/mirror-cartographer-ui/`. If Pages returns 404 or no app shell, fix repository Pages settings or workflow deployment before touching composition. If the phone contract fails, fix the exact contract failure. If all gates pass, return to the audio-visual coupling branch: expose phrase phase, pulse, and weather density in the canvas score without visible explanatory text.

## Later branch

If visible explainers or model demos are still useful, route them away from the stable phone-first instrument. Use a separate experimental branch or gallery route before using a separate stable repo.
