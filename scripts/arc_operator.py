#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ARC_BASE = "https://three.arcprize.org"
SOURCE_URL = "https://github.com/MirrorCartographer/mirror-cartographer-ui"


def request(path: str, method: str = "GET", body: dict | None = None) -> dict:
    key = os.environ.get("ARC_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ARC_API_KEY secret is not configured")
    payload = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        ARC_BASE + path,
        data=payload,
        method=method,
        headers={"X-API-Key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ARC returned HTTP {exc.code}: {raw[:500]}") from exc
    return json.loads(raw) if raw else {}


def save(name: str, data: dict | list) -> None:
    out = Path("artifacts/arc")
    out.mkdir(parents=True, exist_ok=True)
    (out / name).write_text(json.dumps(data, indent=2), encoding="utf-8")


def verify() -> dict:
    games = request("/api/games")
    summary = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "agent": "Lyr",
        "system": "Mirror Cartographer",
        "visible_games": len(games) if isinstance(games, list) else None,
    }
    save("verification.json", summary)
    save("games.json", games)
    return summary


def development_scorecard() -> dict:
    opened = request(
        "/api/scorecard/open",
        "POST",
        {
            "source_url": SOURCE_URL,
            "tags": ["lyr", "mirror-cartographer", "development", "operator-v0.4"],
            "opaque": {
                "agent": "Lyr",
                "system": "Mirror Cartographer",
                "runtime": "operator-v0.4",
                "purpose": "credential-and-scorecard-path-validation",
            },
        },
    )
    card_id = opened["card_id"]
    closed = request("/api/scorecard/close", "POST", {"card_id": card_id})
    save("development-scorecard.json", closed)
    return closed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["verify", "development", "competition-readiness"])
    parser.add_argument("--arm", default="")
    args = parser.parse_args()

    if args.mode == "verify":
        print(json.dumps(verify(), indent=2))
        return 0
    if args.mode == "development":
        verify()
        print(json.dumps(development_scorecard(), indent=2))
        return 0

    verify()
    if args.arm != "ARM-LYR-COMPETITION":
        raise RuntimeError("Competition is blocked. Exact arm phrase required.")
    result = {
        "ready": True,
        "warning": "This check does not start Competition Mode or consume the one-shot environment access.",
        "next": "Run the dedicated competition agent only after development evidence is approved.",
    }
    save("competition-readiness.json", result)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
