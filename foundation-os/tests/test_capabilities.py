import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIA = ROOT / "tools" / "fia.py"


def run(*args):
    return subprocess.run(
        [sys.executable, str(FIA), *args],
        capture_output=True,
        text=True,
    )


def test_verify_passes():
    result = run("verify")
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout)["status"] == "pass"


def test_registry_lists_all_capabilities():
    result = run("capabilities")
    assert result.returncode == 0
    assert len([line for line in result.stdout.splitlines() if line.strip()]) == 24


def test_single_capability_is_provider_null():
    result = run("capabilities", "secrets-identity")
    assert result.returncode == 0
    record = json.loads(result.stdout)
    assert record["authority"] == "foundation"
    assert record["provider"] is None
    assert record["exit_path"]
