import hashlib, unittest, importlib.util
from pathlib import Path
P=Path(__file__).parents[1]/'tools/sovereign_release/public_capability_attestation.py'
spec=importlib.util.spec_from_file_location('m',P); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
def d(x): return 'sha256:'+hashlib.sha256(x.encode()).hexdigest()
def fixture():
 return {'schema':'foundation.private-release-evidence.v1','release_id':'r1','private_commit':'a'*40,'artifacts':[{'name':'runtime.tar','digest':d('artifact')}], 'evidence':[{'id':'e1','kind':'test','result':'pass','output_digest':d('ok')}], 'claims':[{'capability':'deterministic-build','evidence_ids':['e1']}], 'public':{'ownership_boundary':['release authority'],'remaining_dependencies':['internet transit'],'falsification':['rebuild and compare digest']}}
class T(unittest.TestCase):
 def test_emit_verify(self): self.assertEqual([],m.verify(m.emit(fixture())))
 def test_tamper_rejected(self):
  s=m.emit(fixture()); s['predicate']['claims'][0]['capability']='false'; self.assertIn('statement_digest',m.verify(s))
 def test_failed_evidence_blocks_claim(self):
  x=fixture(); x['evidence'][0]['result']='fail'; s=m.emit(x); self.assertIn('claim_0_not_proven',m.verify(s))
 def test_unknown_evidence_rejected(self):
  x=fixture(); x['claims'][0]['evidence_ids']=['missing']; self.assertRaises(ValueError,lambda:m.emit(x))
 def test_private_field_rejected(self):
  x=fixture(); x['public']['transcript']='private'; self.assertRaises(ValueError,lambda:m.emit(x))
 def test_token_pattern_rejected(self):
  x=fixture(); x['public']['ownership_boundary']=['ghp_abcdefghijklmnopqrstuvwxyz']; self.assertRaises(ValueError,lambda:m.emit(x))
if __name__=='__main__': unittest.main()
