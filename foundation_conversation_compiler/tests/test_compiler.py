import json, tempfile, unittest
from pathlib import Path
from foundation_conversation_compiler.compiler import load_events, compile_history, render_source

class CompilerTests(unittest.TestCase):
    def test_deterministic(self):
        rows=[{"timestamp":"2025-01-01","role":"user","text":"Truth and provenance.\n```python\nprint('x')\n```"}]
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"x.json"; p.write_text(json.dumps(rows)); events=load_events(p)
            a=compile_history(events); b=compile_history(events)
            self.assertEqual(a["graph_digest"],b["graph_digest"]); self.assertEqual(len(a["code_blocks"]),1)

    def test_since_filter(self):
        rows=[{"timestamp":"2023-01-01","role":"user","text":"old"},{"timestamp":"2025-01-01","role":"user","text":"new build test"}]
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"x.json"; p.write_text(json.dumps(rows)); graph=compile_history(load_events(p),"2024-01-01")
            self.assertEqual(graph["coverage"]["event_count"],1)

    def test_source_render(self):
        graph={"coverage":{"event_count":0},"graph_digest":"sha256:"+"0"*64,"principles":[],"code_blocks":[]}
        self.assertIn("FOUNDATION",render_source(graph,"X"))

if __name__=="__main__": unittest.main()
