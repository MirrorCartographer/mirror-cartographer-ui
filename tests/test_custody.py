import json, tempfile, unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / "tools" / "sovereign_registry"))
from custody import store, verify, restore, digest_path

class CustodyTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.base = Path(self.t.name)
        self.source = self.base / "release.tar"; self.source.write_bytes(b"foundation-release-v1")
        self.roots = [self.base / "primary", self.base / "recovery"]
        self.ledger = store(self.source, self.roots, "application/vnd.foundation.release")
    def tearDown(self): self.t.cleanup()
    def test_two_copy_quorum(self): self.assertTrue(verify(self.ledger, 2)["accepted"])
    def test_corruption_fails_quorum(self):
        digest_path(self.roots[0], self.ledger["artifact"]["digest"]).write_bytes(b"tampered")
        result = verify(self.ledger, 2); self.assertFalse(result["accepted"]); self.assertIn("copy_quorum", result["errors"])
    def test_single_surviving_copy_restores(self):
        digest_path(self.roots[0], self.ledger["artifact"]["digest"]).unlink()
        out = self.base / "restored.tar"; restore(self.ledger, out, 1)
        self.assertEqual(out.read_bytes(), self.source.read_bytes())
    def test_ledger_tamper_rejected(self):
        changed = json.loads(json.dumps(self.ledger)); changed["artifact"]["size"] += 1
        self.assertIn("ledger_digest", verify(changed, 1)["errors"])
    def test_wrong_path_rejected(self):
        changed = json.loads(json.dumps(self.ledger)); changed["copies"][0]["path"] = "latest"
        self.assertTrue(any(x.startswith("path:") for x in verify(changed, 1)["errors"]))

if __name__ == "__main__": unittest.main()
