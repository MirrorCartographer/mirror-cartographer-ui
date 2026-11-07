import json, unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from secret_gate import decide

CATALOG = json.loads((Path(__file__).resolve().parents[1] / "secret_catalog.json").read_text())

GOOD = {
    "catalog_generation": 1,
    "workload_identity": "spiffe://foundation.internal/reader/api",
    "secret_class": "dynamic-database",
    "secret_path": "database/reader",
    "requested_ttl_seconds": 300,
    "injection_mode": "file",
    "persist_to_kubernetes_secret": False,
    "audit_receipt_requested": True
}

class SecretGateTests(unittest.TestCase):
    def test_valid_dynamic_secret(self):
        self.assertEqual(decide(CATALOG, GOOD)["decision"], "ISSUE")

    def test_stale_generation_rejected(self):
        bad = dict(GOOD, catalog_generation=0)
        self.assertIn("catalog-generation", decide(CATALOG, bad)["failures"])

    def test_environment_and_kubernetes_persistence_rejected(self):
        bad = dict(GOOD, injection_mode="environment", persist_to_kubernetes_secret=True)
        failures = decide(CATALOG, bad)["failures"]
        self.assertIn("environment-injection", failures)
        self.assertIn("kubernetes-persistence", failures)

    def test_excessive_ttl_rejected(self):
        bad = dict(GOOD, requested_ttl_seconds=3600)
        self.assertIn("ttl", decide(CATALOG, bad)["failures"])

    def test_unknown_workload_rejected(self):
        bad = dict(GOOD, workload_identity="spiffe://foundation.internal/unknown")
        self.assertEqual(decide(CATALOG, bad)["decision"], "DENY")

if __name__ == "__main__":
    unittest.main()
