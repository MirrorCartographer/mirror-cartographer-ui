#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path

DIGEST_RE = re.compile(r'^sha256:[0-9a-f]{64}$')
COMMIT_RE = re.compile(r'^[0-9a-f]{40}$')
FORBIDDEN_KEYS = {'transcript','conversation','health','animal','credential','location','deleted_text','raw_text','secret','token','email'}
FORBIDDEN_VALUE_PATTERNS = [re.compile(r'BEGIN (?:RSA |OPENSSH )?PRIVATE KEY'), re.compile(r'\b(?:sk-|ghp_|github_pat_)\w+'), re.compile(r'@\w+\.\w+')]


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def digest(value: object) -> str:
    return 'sha256:' + hashlib.sha256(canonical_bytes(value)).hexdigest()

def walk(value: object, path: str=''):
    if isinstance(value, dict):
        for k,v in value.items():
            p=f'{path}.{k}' if path else k
            yield p,k,v
            yield from walk(v,p)
    elif isinstance(value,list):
        for i,v in enumerate(value):
            p=f'{path}[{i}]'
            yield p,'',v
            yield from walk(v,p)

def privacy_failures(value: object) -> list[str]:
    out=[]
    for path,key,v in walk(value):
        if key.lower() in FORBIDDEN_KEYS:
            out.append(f'forbidden_key:{path}')
        if isinstance(v,str):
            for pat in FORBIDDEN_VALUE_PATTERNS:
                if pat.search(v): out.append(f'forbidden_value:{path}')
    return sorted(set(out))

def validate_private_manifest(m: dict) -> list[str]:
    f=[]
    if m.get('schema')!='foundation.private-release-evidence.v1': f.append('schema')
    if not COMMIT_RE.match(m.get('private_commit','')): f.append('private_commit')
    arts=m.get('artifacts',[])
    if not arts: f.append('artifacts')
    for i,a in enumerate(arts):
        if not a.get('name'): f.append(f'artifact_{i}_name')
        if not DIGEST_RE.match(a.get('digest','')): f.append(f'artifact_{i}_digest')
    ev={e.get('id'):e for e in m.get('evidence',[]) if e.get('id')}
    for i,e in enumerate(m.get('evidence',[])):
        if e.get('result') not in {'pass','fail','blocked'}: f.append(f'evidence_{i}_result')
        if not DIGEST_RE.match(e.get('output_digest','')): f.append(f'evidence_{i}_output_digest')
    for i,c in enumerate(m.get('claims',[])):
        if not c.get('capability'): f.append(f'claim_{i}_capability')
        ids=c.get('evidence_ids',[])
        if not ids: f.append(f'claim_{i}_evidence_ids')
        if any(x not in ev for x in ids): f.append(f'claim_{i}_unknown_evidence')
    f += privacy_failures(m.get('public',{}))
    return sorted(set(f))

def emit(m: dict) -> dict:
    failures=validate_private_manifest(m)
    if failures: raise ValueError(','.join(failures))
    evidence=[{'id':e['id'],'kind':e['kind'],'result':e['result'],'output_digest':e['output_digest']} for e in m['evidence']]
    statement={
      '_type':'https://in-toto.io/Statement/v1',
      'subject':[{'name':a['name'],'digest':{'sha256':a['digest'].split(':',1)[1]}} for a in m['artifacts']],
      'predicateType':'https://mirrorcartographer.org/attestations/private-capability/v1',
      'predicate':{
        'release_id':m['release_id'],
        'private_anchor':{'repository':'MirrorCartographer/mirror-cartographer-ui','commit':m['private_commit']},
        'claims':m['claims'],
        'evidence':evidence,
        'ownership_boundary':m['public']['ownership_boundary'],
        'remaining_dependencies':m['public']['remaining_dependencies'],
        'falsification':m['public']['falsification'],
        'privacy':{'raw_private_content_published':False,'classification':'public-safe-abstracted'}
      }
    }
    statement['statement_digest']=digest(statement)
    return statement

def verify(s: dict) -> list[str]:
    f=[]
    supplied=s.get('statement_digest','')
    bare=dict(s); bare.pop('statement_digest',None)
    if supplied != digest(bare): f.append('statement_digest')
    if s.get('_type')!='https://in-toto.io/Statement/v1': f.append('_type')
    p=s.get('predicate',{})
    if p.get('private_anchor',{}).get('repository')!='MirrorCartographer/mirror-cartographer-ui': f.append('private_anchor_repository')
    if not COMMIT_RE.match(p.get('private_anchor',{}).get('commit','')): f.append('private_anchor_commit')
    evidence={e.get('id'):e for e in p.get('evidence',[])}
    for i,c in enumerate(p.get('claims',[])):
        ids=c.get('evidence_ids',[])
        if not ids or any(x not in evidence for x in ids): f.append(f'claim_{i}_evidence')
        if any(evidence[x].get('result')!='pass' for x in ids if x in evidence): f.append(f'claim_{i}_not_proven')
    if p.get('privacy',{}).get('raw_private_content_published') is not False: f.append('privacy')
    f += privacy_failures(s)
    return sorted(set(f))

def main() -> int:
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd',required=True)
    e=sub.add_parser('emit'); e.add_argument('private_manifest'); e.add_argument('public_statement')
    v=sub.add_parser('verify'); v.add_argument('public_statement')
    a=ap.parse_args()
    if a.cmd=='emit':
        m=json.loads(Path(a.private_manifest).read_text()); s=emit(m); Path(a.public_statement).write_text(json.dumps(s,indent=2,sort_keys=True)+'\n'); print(s['statement_digest']); return 0
    s=json.loads(Path(a.public_statement).read_text()); failures=verify(s)
    if failures:
        print('REJECT'); [print('- '+x) for x in failures]; return 1
    print('ACCEPT'); print(s['statement_digest']); return 0
if __name__=='__main__': raise SystemExit(main())
