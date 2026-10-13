"""Regression tests for the deterministic self-model audit; Python standard library only."""
import json, os, subprocess, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "tools" / "self_model" / "run_cycle.py"
REGISTRY = ROOT / "agents" / "self-model" / "agent-registry.json"
EXPECTED = ["research", "resources", "art", "build", "integration"]

class SelfModelAuditTests(unittest.TestCase):
    def test_registry_has_five_unique_ordered_roles(self):
        data = json.loads(REGISTRY.read_text(encoding="utf-8"))
        ids = [a["id"] for a in data["agents"]]
        self.assertEqual(ids, EXPECTED)
        self.assertEqual(len(ids), len(set(ids)))
        for agent in data["agents"]:
            self.assertTrue(agent["purpose"])
            self.assertTrue(agent["acceptance"])

    def test_safety_invariants_fail_closed(self):
        rules = json.loads(REGISTRY.read_text(encoding="utf-8"))["global_rules"]
        self.assertIs(rules["no_direct_main_writes"], True)
        self.assertIs(rules["no_auto_merge"], True)
        self.assertIs(rules["raw_private_conversation_publication"], False)
        self.assertIs(rules["platform_limit_evasion"], False)

    def test_each_role_emits_an_explicit_audit_receipt(self):
        for role in EXPECTED:
            with self.subTest(role=role):
                env = os.environ.copy()
                env["MC_AGENT"] = role
                result = subprocess.run([sys.executable, str(RUNNER)], cwd=ROOT, env=env,
                    text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                self.assertEqual(result.returncode, 0, result.stderr)
                path = ROOT / f"self-model-run-receipt-{role}.json"
                receipt = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(receipt["active_agent"], role)
                self.assertEqual(receipt["run_mode"], "deterministic-audit-only")
                self.assertEqual(receipt["result"], "pass")
                self.assertTrue(receipt["limitations"])
                path.unlink(missing_ok=True)

if __name__ == "__main__":
    unittest.main()
