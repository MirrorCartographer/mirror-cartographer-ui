"""
Command-line wrapper for the Dualpath Taste Engine.

Voice-readable behavior:
Give this script a JSON file describing one artist. It writes a taste report in Markdown. The evidence path and field path are evaluated separately before the convergence verdict is produced.

Example:
python engines/music/taste_cli.py --input examples/taste/artist.json --out out/taste_report.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from engines.music.taste_engine import decision_from_json


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="JSON file with artist, evidence, and field scores.")
    parser.add_argument("--out", required=True, help="Markdown output path for the taste report.")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    decision = decision_from_json(payload)
    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(decision.to_markdown(), encoding="utf-8")

    print("WROTE", output_path)
    print("artist", decision.artist)
    print("verdict", decision.verdict)
    print("convergence_status", decision.convergence_status)


if __name__ == "__main__":
    main()
