from __future__ import annotations
import argparse, hashlib, json, re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

CODE_BLOCK = re.compile(r"```(?P<lang>[A-Za-z0-9_+\-]*)\n(?P<body>.*?)```", re.S)

@dataclass(frozen=True)
class Event:
    timestamp: str
    role: str
    text: str
    source: str

def canonical_digest(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()

def load_events(path: Path) -> list[Event]:
    data = json.loads(path.read_text())
    rows = data["messages"] if isinstance(data, dict) and "messages" in data else data
    return [Event(str(r.get("timestamp") or r.get("create_time") or ""), str(r.get("role") or r.get("author", {}).get("role") or "unknown"), str(r.get("text") or r.get("content") or ""), str(r.get("source") or f"{path.name}:{i}")) for i, r in enumerate(rows)]

def extract_code(events: Iterable[Event]) -> list[dict]:
    blocks = []
    for event in events:
        for index, match in enumerate(CODE_BLOCK.finditer(event.text)):
            body = match.group("body").rstrip() + "\n"
            blocks.append({"id": canonical_digest({"source": event.source, "index": index, "body": body}), "language": match.group("lang") or "text", "body": body, "timestamp": event.timestamp, "role": event.role, "source": event.source})
    return blocks

def infer_principles(events: Iterable[Event]) -> list[dict]:
    patterns = [("truth_over_convenience", r"\btruth\b|\bprovenance\b|\bevidence\b"), ("continuous_identity", r"\bcontinuity\b|\bidentity\b|\bno resets?\b"), ("replaceability", r"\breplaceab|\bprovider\b|\bsovereign\b"), ("build_not_only_plan", r"\bbuild\b|\bimplement\b|\bexecutable\b|\btest\b"), ("privacy_boundary", r"\bprivate\b|\bpublic-safe\b|\bprivacy\b"), ("adversarial_verification", r"\badversarial\b|\bfalsif|\breject\b|\bfail closed\b"), ("access_parallax", r"\bnon-observation\b|\baccess parallax\b|\bvisibility\b")]
    joined = "\n".join(e.text for e in events)
    result = [{"name": n, "evidence_hits": len(re.findall(p, joined, flags=re.I))} for n, p in patterns]
    return sorted([x for x in result if x["evidence_hits"]], key=lambda x: (-x["evidence_hits"], x["name"]))

def compile_history(events: list[Event], since: str | None = None) -> dict:
    selected = [e for e in events if not since or not e.timestamp or e.timestamp >= since]
    graph = {"schema": "foundation.conversation-compiler.v1", "coverage": {"event_count": len(selected), "since": since, "complete_corpus_claimed": False}, "principles": infer_principles(selected), "code_blocks": extract_code(selected), "timeline": [{"timestamp": e.timestamp, "role": e.role, "source": e.source, "digest": canonical_digest(e.text)} for e in selected]}
    graph["graph_digest"] = canonical_digest(graph)
    return graph

def render_source(graph: dict, title: str) -> str:
    lines = [f"# {title}", "", f"Corpus events compiled: {graph['coverage']['event_count']}", f"Graph digest: `{graph['graph_digest']}`", "", "```foundation", "FOUNDATION {"]
    lines += [f"  {p['name']} = evidence_hits({p['evidence_hits']})" for p in graph["principles"]]
    lines += ["}", "", "LOOP conversation -> normalize -> graph -> build -> test -> challenge -> repair -> publish_safe -> preserve_private", "```", "", "## Recovered code blocks", ""]
    if not graph["code_blocks"]: lines.append("_No literal fenced code blocks were available in the supplied corpus._")
    for i, b in enumerate(graph["code_blocks"], 1): lines += [f"### Block {i} · {b['language']} · {b['source']}", "", f"```{b['language']}", b["body"].rstrip(), "```", ""]
    return "\n".join(lines)

def main() -> int:
    p = argparse.ArgumentParser(prog="conversation-compiler"); p.add_argument("input"); p.add_argument("--out", required=True); p.add_argument("--since"); a = p.parse_args()
    graph = compile_history(load_events(Path(a.input)), a.since); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    (out/"graph.json").write_text(json.dumps(graph, indent=2, ensure_ascii=False)+"\n"); (out/"source.md").write_text(render_source(graph, "Compiled Conversation Source")); print(graph["graph_digest"]); return 0

if __name__ == "__main__": raise SystemExit(main())
