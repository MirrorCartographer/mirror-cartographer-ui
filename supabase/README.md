# Supabase runtime setup

The GitHub Pages application remains a static frontend. Supabase supplies authenticated continuity, shared presence, and the optional resident-dialogue runtime.

## One-time project setup

1. Link the Supabase project with the Supabase CLI.
2. Apply the SQL migrations in order:
   - `db/001_continuity_records.sql`
   - `db/002_shared_world_presence.sql`
3. Confirm that Auth magic-link redirects allow:
   `https://mirrorcartographer.github.io/mirror-cartographer-ui/`
4. Add these GitHub repository Actions variables (they are public browser configuration, not secrets):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

The service-role key must never be added to GitHub Pages variables or browser code.

## Resident dialogue provider

The residents can accept free-text dialogue through the authenticated Edge Function. The function reads only the visitor's own continuity record, and only when private-memory sync is explicitly enabled. It does not write chat transcripts or new memories.

Set server-side Supabase function secrets:

- `MODEL_API_URL` — complete OpenAI-compatible chat-completions endpoint
- `MODEL_API_KEY` — provider credential
- `MODEL_NAME` — provider model identifier
- `ALLOWED_ORIGINS` — comma-separated allowed origins; include `https://mirrorcartographer.github.io`

Then deploy:

```sh
supabase functions deploy resident-dialogue
supabase secrets set MODEL_API_URL=... MODEL_API_KEY=... MODEL_NAME=... ALLOWED_ORIGINS=https://mirrorcartographer.github.io
```

The function uses the visitor's Supabase JWT and anon key for user-scoped continuity reads. Provider credentials remain server-side. If the function or provider is not deployed/configured, free dialogue returns a visible unavailable state; scripted dialogue and the rest of the world continue to work.

## What this enables

- Email magic-link authentication
- Private account continuity when the visitor explicitly opts into cross-device memory sync
- Expiring co-presence with private, accepted-connections, and public visibility
- Account-code connection requests with accept, decline, cancel, and revoke transitions
- Tazar/Jello model dialogue through a replaceable OpenAI-compatible provider

It does not enable camera sensing, speech transcription, emotion detection, or autonomous agent behavior between visits. The microphone path measures only a transient local sound envelope.
