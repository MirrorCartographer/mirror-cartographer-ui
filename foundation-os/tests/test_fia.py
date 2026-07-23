import importlib.util
from pathlib import Path

MODULE = Path(__file__).parents[1] / "tools" / "fia.py"
spec = importlib.util.spec_from_file_location("fia", MODULE)
fia = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fia)

def test_lifecycle_gate_passes():
    assert fia.verify()["status"] == "pass"

def test_complete_capability_surface():
    plan = fia.load(fia.LIFECYCLE)
    assert {c["id"] for c in plan["capabilities"]} == fia.REQUIRED

def test_no_hardware_ownership_claim():
    assert fia.load(fia.LIFECYCLE)["hardware_ownership_claim"] is False
