# Lyr / MirrorCartographer ARC Competition Connector

## Purpose

This connector establishes a registered, provenance-linked ARC-AGI-3 path without storing API keys in source control.

## Flow

1. Open `/arc-competition.html` on the deployed site.
2. Use the official ARC platform button and authenticate with GitHub or Google.
3. Create an ARC API key in the ARC profile.
4. Paste it into the control room. The key exists only in the open browser tab.
5. Verify access using `GET /api/games` through the Vercel proxy.
6. Open a scorecard tagged with Lyr / MirrorCartographer identity and repository provenance.
7. Run the agent with `OPERATION_MODE=COMPETITION`.
8. Close the scorecard cleanly. ARC adds eligible agent scorecards to the leaderboard in periodic batches.

## Security boundary

- Never commit `ARC_API_KEY`.
- Never put the key in a URL, screenshot, console message, or telemetry payload.
- The browser does not use localStorage or sessionStorage for the key.
- The proxy forwards the key only in `X-API-Key` to `https://three.arcprize.org`.
- ARC session-affinity cookies are returned to the browser as opaque name/value pairs and sent back through the proxy for subsequent game calls.

## Competition constraints

Competition Mode requires API-hosted environments, scores all available environments, permits only one scorecard, and restricts each environment to one `make` call. The runtime must therefore finish every game deliberately and close the card rather than treating the official run as an exploratory development session.

## Next runtime integration

The Python runtime should accept:

- `--competition`
- `--all-games`
- `LYR_SCORECARD_ID`
- `ARC_API_KEY`

It should persist no secret material, attach compact reasoning metadata to actions, save local replay evidence, and always close the scorecard in a `finally` block.
