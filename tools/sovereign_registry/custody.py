#!/usr/bin/env python3
"""Owned artifact custody ledger and restore verifier.

Stores artifact bytes under sha256 content addresses in independently mounted roots.
The ledger, not a registry tag, is the release/restore authority.
"""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, sys, tempfile
from pathlib import Path

SCHEMA = "foundation.artifact-custody.v1"

def sha256_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()

def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()

def digest_path(root: Path, digest: str) -> Path:
    algo, hexdigest = digest.split(":", 1)
    if algo != "sha256" or len(hexdigest) != 64:
        raise ValueError("unsupported digest")
    return root / "blobs" / algo / hexdigest[:2] / hexdigest

def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".custody-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def store(source: Path, roots: list[Path], media_type: str) -> dict:
    data = source.read_bytes()
    digest = sha256_bytes(data)
    copies = []
    for root in roots:
        target = digest_path(root, digest)
        atomic_write(target, data)
        copies.append({"root": str(root), "path": str(target.relative_to(root))})
    body = {"schema": SCHEMA, "artifact": {"digest": digest, "size": len(data), "media_type": media_type}, "copies": copies}
    body["ledger_digest"] = sha256_bytes(canonical(body))
    return body

def verify(ledger: dict, minimum_good_copies: int = 2) -> dict:
    errors, findings, good = [], [], []
    if ledger.get("schema") != SCHEMA: errors.append("schema")
    artifact = ledger.get("artifact", {})
    digest, size = artifact.get("digest", ""), artifact.get("size")
    if not isinstance(digest, str) or not digest.startswith("sha256:"): errors.append("digest")
    if not isinstance(size, int) or size < 0: errors.append("size")
    supplied = ledger.get("ledger_digest")
    unsigned = dict(ledger); unsigned.pop("ledger_digest", None)
    if supplied != sha256_bytes(canonical(unsigned)): errors.append("ledger_digest")
    for copy in ledger.get("copies", []):
        root = Path(copy.get("root", "")); rel = Path(copy.get("path", ""))
        expected = digest_path(root, digest) if digest.startswith("sha256:") else root / "invalid"
        candidate = root / rel
        if candidate != expected: errors.append(f"path:{root}"); continue
        try: data = candidate.read_bytes()
        except OSError: findings.append(f"missing:{root}"); continue
        if len(data) != size: findings.append(f"size:{root}"); continue
        if sha256_bytes(data) != digest: findings.append(f"digest:{root}"); continue
        good.append(str(root))
    if len(set(good)) < minimum_good_copies: errors.append("copy_quorum")
    return {"accepted": not errors, "good_copies": sorted(set(good)), "findings": findings, "errors": errors}

def restore(ledger: dict, destination: Path, minimum_good_copies: int = 1) -> dict:
    result = verify(ledger, minimum_good_copies)
    if not result["accepted"]: raise RuntimeError("restore gate rejected: " + ",".join(result["errors"]))
    digest = ledger["artifact"]["digest"]
    for root_text in result["good_copies"]:
        source = digest_path(Path(root_text), digest)
        atomic_write(destination, source.read_bytes())
        if sha256_bytes(destination.read_bytes()) != digest: raise RuntimeError("post-restore digest mismatch")
        return {"restored_from": root_text, "digest": digest, "destination": str(destination)}
    raise RuntimeError("no readable copy")

def main() -> int:
    p = argparse.ArgumentParser(); sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("store"); s.add_argument("source"); s.add_argument("ledger"); s.add_argument("roots", nargs="+"); s.add_argument("--media-type", default="application/octet-stream")
    v = sub.add_parser("verify"); v.add_argument("ledger"); v.add_argument("--minimum-good-copies", type=int, default=2)
    r = sub.add_parser("restore"); r.add_argument("ledger"); r.add_argument("destination"); r.add_argument("--minimum-good-copies", type=int, default=1)
    a = p.parse_args()
    if a.cmd == "store":
        ledger = store(Path(a.source), [Path(x) for x in a.roots], a.media_type); Path(a.ledger).write_text(json.dumps(ledger, indent=2, sort_keys=True)+"\n"); print(ledger["artifact"]["digest"]); return 0
    ledger = json.loads(Path(a.ledger).read_text())
    if a.cmd == "verify":
        result = verify(ledger, a.minimum_good_copies); print(json.dumps(result, sort_keys=True)); return 0 if result["accepted"] else 1
    print(json.dumps(restore(ledger, Path(a.destination), a.minimum_good_copies), sort_keys=True)); return 0
if __name__ == "__main__": raise SystemExit(main())
