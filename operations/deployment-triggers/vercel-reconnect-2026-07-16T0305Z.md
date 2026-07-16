# Vercel reconnect deployment trigger

The Vercel project was reconnected to this private GitHub repository on 2026-07-16.

This commit intentionally triggers a fresh production build from `main`.

Expected checks:
- install dependencies
- run the Vite production build
- publish a replacement public deployment URL
- preserve deployment identity evidence
- report build or account-level blockers without disabling the repository integration
