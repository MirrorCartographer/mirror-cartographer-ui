#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = b => 'sha256:' + crypto.createHash('sha256').update(b).digest('hex');
const canonical = v => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
const digest = v => sha256(Buffer.from(canonical(v)));
function fail(m){ throw new Error(m); }
function inside(root,p){ const r=path.relative(path.resolve(root),path.resolve(p)); if(r.startsWith('..')||path.isAbsolute(r)) fail('path escape'); }
function verify(bundle){
  const root=path.resolve(bundle);
  const p=path.join(root,'rollback-manifest.json');
  if(!fs.existsSync(p)) fail('missing rollback manifest');
  const m=JSON.parse(fs.readFileSync(p,'utf8'));
  if(m.schema!=='fia.rollback-bundle.v1') fail('unsupported schema');
  if(m.provider!==null) fail('provider must be null');
  if(m.release_authority!=='foundation-intelligence') fail('invalid release authority');
  if(m.autoplay!==false) fail('autoplay must remain disabled');
  if(!m.previous_release_digest?.startsWith('sha256:')) fail('invalid previous release digest');
  if(!m.target_release_digest?.startsWith('sha256:')) fail('invalid target release digest');
  if(m.previous_release_digest===m.target_release_digest) fail('rollback target equals current release');
  const supplied=m.bundle_digest; const u={...m}; delete u.bundle_digest;
  if(digest(u)!==supplied) fail('manifest digest mismatch');
  if(!Array.isArray(m.artifacts)||m.artifacts.length===0) fail('empty artifact set');
  const seen=new Set();
  for(const a of m.artifacts){
    if(seen.has(a.path)) fail('duplicate artifact path'); seen.add(a.path);
    const f=path.resolve(root,a.path); inside(root,f);
    const st=fs.lstatSync(f); if(st.isSymbolicLink()) fail('symlink rejected');
    if(!st.isFile()) fail('artifact not file');
    if((st.mode&0o777)!==a.mode) fail(`mode mismatch: ${a.path}`);
    const b=fs.readFileSync(f);
    if(b.length!==a.size) fail(`size mismatch: ${a.path}`);
    if(sha256(b)!==a.sha256) fail(`digest mismatch: ${a.path}`);
  }
  if(!m.health_gate || m.health_gate.required!==true || m.health_gate.timeout_seconds<1) fail('invalid health gate');
  if(!Array.isArray(m.rollback_steps) || m.rollback_steps.length<2) fail('insufficient rollback steps');
  if(!m.export || m.export.format!=='tar' || m.export.provider_neutral!==true) fail('invalid export contract');
  return {status:'accept',bundle_digest:supplied,artifacts:m.artifacts.length,target_release_digest:m.target_release_digest};
}
try { console.log(JSON.stringify(verify(process.argv[2]),null,2)); }
catch(e){ console.error(e.message); process.exit(1); }
