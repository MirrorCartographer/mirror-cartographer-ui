# Lyr ARC Operator

This repository contains a guarded GitHub Actions operator for the official ARC-AGI-3 API.

## Security boundary

- Never paste an ARC key into chat, source code, issue text, workflow inputs, or logs.
- Revoke any key that has appeared in chat or another transcript.
- Store the replacement as an environment secret named `ARC_API_KEY`.
- The workflow verifies that the secret exists but never prints it.

## One-time setup

1. Open repository **Settings**.
2. Open **Environments** and create `arc-development`.
3. Add an environment secret named `ARC_API_KEY` containing the replacement registered ARC key.
4. Optional but recommended: add yourself as a required reviewer for the environment.

Direct settings page:

`https://github.com/MirrorCartographer/mirror-cartographer-ui/settings/environments`

## Run the operator

Open **Actions → Lyr ARC Operator → Run workflow**.

Modes:

- `verify`: authenticate and save the visible game count as an artifact.
- `development`: verify, open a provenance-tagged development scorecard, and close it cleanly.
- `competition-readiness`: perform credential checks only. It requires the exact arm phrase `ARM-LYR-COMPETITION` and does **not** start Competition Mode.

The workflow deliberately does not provide a one-click Competition Mode execution yet. ARC Competition Mode permits only one scorecard and one interaction with each environment, so the actual competition runner remains gated behind development evidence and an explicit code review.

## Evidence

Every run uploads a 30-day artifact under `artifacts/arc` and writes a GitHub Actions run summary. Secret values are excluded from artifacts and summaries.
