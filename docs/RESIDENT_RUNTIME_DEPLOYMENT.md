# Resident runtime deployment

The resident dialogue path is implemented in source. It is not live until the Supabase database schema, Edge Function, and provider configuration are applied to the same Supabase project.

## 1. Apply the database schema

Run these files in order in the Supabase SQL Editor:

1. `db/001_continuity_records.sql`
2. `db/002_shared_world_presence.sql`

The first creates private continuity storage and its owner-only policies. The second creates connection requests and expiring room presence with RLS. Neither migration stores perception events or conversation transcripts.

## 2. Configure GitHub Pages

In the GitHub repository settings, add these as Actions **Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

They are public browser configuration values. Do not put a service-role key in either variable.

The Pages workflow reads these variables during `npm run build:pages`. If either is absent, the personal world still loads, but shared sign-in and model dialogue remain unavailable.

## 3. Deploy the Edge Function

From a local checkout with the Supabase CLI installed:

```sh
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase functions deploy resident-dialogue
```

The function uses the Supabase-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY` runtime values to verify the visitor's bearer token. It does not use the service-role key.

## 4. Configure the model provider

Set these as Supabase Edge Function secrets, never as Vite variables:

```sh
supabase secrets set \
  MODEL_API_URL="https://YOUR_OPENAI_COMPATIBLE_PROVIDER/v1/chat/completions" \
  MODEL_API_KEY="YOUR_PROVIDER_SECRET" \
  MODEL_NAME="YOUR_MODEL_ID" \
  ALLOWED_ORIGINS="https://mirrorcartographer.github.io,http://localhost:5173"
```

The provider must accept an OpenAI-compatible chat-completions request and return `choices[0].message.content`. The function limits message size, history length, output size, and scene cues. It verifies the Supabase user before calling the provider.

## 5. Configure authentication redirects

In Supabase Authentication URL configuration, allow the exact Pages application URL:

`https://mirrorcartographer.github.io/mirror-cartographer-ui/`

Also allow `http://localhost:5173/` for local development if needed. The function's `ALLOWED_ORIGINS` setting is an origin allowlist; origins do not include URL paths.

## 6. What a live resident request sends

- The selected resident key (`tazar` or `jello`)
- The visitor's explicit message
- One allowlisted scene cue (for example `approach-tazar`, `sound`, `still`, or `away`) and a clamped intensity
- Up to eight prior user/assistant turns held in page memory
- Prior visit count and explicit choices only when private-memory sync consent is enabled

Raw microphone samples, pointer coordinates, account IDs, and inferred psychological states are not sent as perception context. The Edge Function does not write dialogue turns to Supabase. The configured model provider receives the message and bounded in-session context; provider-side processing and retention follow that provider's terms.

## 7. Verification states

- `401`: visitor must sign in.
- `403`: request origin is not in `ALLOWED_ORIGINS`.
- `503`: Supabase or model provider configuration is incomplete.
- `502`: provider request or response failed.
- `504`: provider request timed out.

A committed function is not a deployed function. A successful local test is not proof of a live provider response. Verify the deployed function and Pages build separately.
