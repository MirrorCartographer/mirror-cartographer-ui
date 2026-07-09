# Parallel preview lane

Current host verdict: keep Vercel as the stable/default host, but do not depend on it as the only verification lane while build-rate limiting is active.

Minimum second lane:

- Cloudflare Pages
- build command: npm run build
- output directory: dist
- Node version: current LTS

Why Cloudflare Pages first:

- The app is a static Vite build.
- The repo already uses relative asset paths through Vite base config.
- The existing preview checker can test multiple candidates through SITE_URLS.
- A second host improves testing confidence without splitting the source repo.

Do not migrate the repo yet. Use the parallel lane only for reachable app-shell verification and live smoke testing.

Next command once the Cloudflare URL exists:

SITE_URLS=<vercel-url>,<cloudflare-url> npm run test:preview-url

Then:

SITE_URL=<passing-url> npm run test:live
