#!/usr/bin/env python3
import json
from pathlib import Path

manifest = json.loads(Path(__file__).with_name('utf8-evidence-vectors.json').read_text(encoding='utf-8'))
failures = []
for vector in manifest['vectors']:
    data = bytes.fromhex(vector['hex'])
    try:
        data.decode('utf-8', errors='strict')
        valid = True
    except UnicodeDecodeError:
        valid = False
    if valid != vector['utf8_valid']:
        failures.append({'id': vector['id'], 'expected': vector['utf8_valid'], 'python': valid})
if failures:
    raise SystemExit(json.dumps({'ok': False, 'failures': failures}, indent=2))
print(json.dumps({'ok': True, 'runtime': 'python', 'vectors': len(manifest['vectors'])}))
