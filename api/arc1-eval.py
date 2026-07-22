from http.server import BaseHTTPRequestHandler
import io
import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "arc1"))
from lyr_arc1_solver import solve

DATA_URL = "https://github.com/fchollet/ARC-AGI/archive/refs/heads/master.zip"


def evaluate():
    req = urllib.request.Request(DATA_URL, headers={"User-Agent": "Lyr-Mirror-Cartographer/0.1"})
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = response.read()

    solved = 0
    report = []
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        names = sorted(
            n for n in archive.namelist()
            if "/data/evaluation/" in n and n.endswith(".json")
        )
        for name in names:
            task = json.loads(archive.read(name))
            predictions = solve(task)
            truth = [pair["output"] for pair in task["test"]]
            ok = any(output == truth for _, output in predictions)
            solved += int(ok)
            report.append({
                "task": Path(name).stem,
                "solved": ok,
                "programs": [program for program, _ in predictions],
            })

    total = len(report)
    return {
        "system": "Lyr / Mirror Cartographer",
        "benchmark": "ARC-AGI-1 public evaluation",
        "solved": solved,
        "total": total,
        "percentage": (100.0 * solved / total) if total else 0.0,
        "metric": "task exact match; up to 3 candidates selected only by demonstration-pair fit",
        "tasks": report,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = evaluate()
            body = json.dumps(result).encode("utf-8")
            self.send_response(200)
        except Exception as exc:
            body = json.dumps({"error": type(exc).__name__, "message": str(exc)}).encode("utf-8")
            self.send_response(500)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
