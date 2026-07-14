# Mirror Cartographer Infrastructure

## Architecture

The application remains usable as a local-first interface, but production continuity is routed through a server boundary:

- `src/services/infrastructure.js` — authenticated browser client.
- `api/index.js` — Vercel serverless API and route dispatcher.
- `server/auth.js` — Supabase bearer verification and signed development sessions.
- `server/repository.js` — collection validation, persistence, export, and signed-upload preparation.
- `db/001_continuity_records.sql` — Postgres schema, indexes, RLS, and private storage policies.
- `public/sw.js` and `public/manifest.webmanifest` — offline application shell.

The browser never receives the Supabase service-role key. Private records and file-upload signing pass through the API.

## Collections

The API currently accepts these bounded collections:

`archive_entries`, `symbols`, `body_markers`, `health_events`, `animals`, `vet_records`, `research_claims`, `evidence_nodes`, `concept_nodes`, `decisions`, `projects`, `artifacts`, `offers`, `money_events`, `proof_scenes`, `arc_experiments`, and `settings`.

Every record has an owner, privacy scope, source, tags, timestamps, and structured JSON content.

## Production setup

1. Create a Supabase project.
2. Run `db/001_continuity_records.sql` in the SQL editor.
3. Configure the variables in `.env.example` as Vercel environment variables.
4. Use a random `SESSION_SECRET` of at least 32 characters.
5. Set `APP_ORIGIN` to the canonical HTTPS site origin.
6. Deploy through the existing Vercel workflow.
7. Verify `GET /api?action=health` reports `persistence: supabase`.
8. Run `npm run test:infrastructure`, then the existing local and remote gates.

## Authentication

Production authentication uses Supabase Auth:

- `POST /api?action=auth.magic-link` requests an email magic link.
- Browser clients store the returned Supabase access token and send it as a bearer token.
- The server validates the token against Supabase Auth before allowing record or upload actions.

`auth.development` exists only outside production and generates a signed local session for development.

## Persistence and privacy

The API validates collection names and privacy values. Production records are stored in `continuity_records`. RLS permits owners to access their own records and permits anonymous reading only for records explicitly marked `public-safe` when requests are made directly through Supabase. The server API currently requires authentication for all record routes.

Private files are stored under an owner-prefixed path in the `mirror-cartographer-private` bucket. Storage policies bind the first path segment to the authenticated user ID.

## API actions

- `health`
- `config.public`
- `auth.magic-link`
- `auth.development` — development only
- `records.list`
- `records.upsert`
- `records.delete`
- `records.export`
- `uploads.prepare`

## Current boundary

This infrastructure is implemented but external services are not automatically provisioned. Until Supabase credentials are configured, the API uses process-memory persistence in local development and deliberately refuses to start in production. Payment values are configuration links; no payment processor secret is stored or invoked. Medical and veterinary records remain organizational data, not diagnostic output.
