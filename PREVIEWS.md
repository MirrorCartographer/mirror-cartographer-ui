# Repository Preview Hub

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/MirrorCartographer/mirror-cartographer-ui?quickstart=1)

This repository now carries its own disposable development host configuration.

## Open the live app

1. Select **Open in GitHub Codespaces** above.
2. Wait for dependency installation and the preview server to start.
3. Open **Mirror Cartographer live preview** when GitHub forwards port `5173`.

The environment runs:

```text
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

The same repository also runs locally:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Then open `http://localhost:5173`.

## Sharing a running preview

The forwarded port stays private by default. This prevents an unreviewed development server from becoming public automatically.

To share a specific running preview:

1. Open the Codespaces **Ports** panel.
2. Find port `5173`.
3. Change **Port Visibility** to **Public** or **Organization**.
4. Copy the generated `app.github.dev` address.
5. Return the port to **Private** when the review ends.

A Codespaces preview is ephemeral. It exists only while that Codespace runs. It is not the canonical production deployment, artifact store, release authority, or recovery path.

## Ownership boundary

The project owns:

- the dev-container specification
- dependency lockfile
- startup command
- application source
- preview behavior
- port exposure policy recorded in the repository

GitHub currently supplies replaceable compute, networking, browser routing, and temporary TLS for the Codespace preview.
