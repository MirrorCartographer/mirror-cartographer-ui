#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
for (const k of ['transaction','objects','output']) if (!args[k]) throw new Error(`missing --${k}`);
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const stable = v => JSON.stringify(canonical(v));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const digest = b => `sha256:${sha(b)}`;
const validDigest = d => /^sha256:[0-9a-f]{64}$/.test(d);
const identityOf = doc => digest(Buffer.from(stable(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=='identity')))));
const resolveInside = (base,p) => {
  if (path.isAbsolute(p)) throw new Error(`absolute path forbidden: ${p}`);
  const r = path.resolve(base,p);
  if (r !== base && !r.startsWith(base+path.sep)) throw new Error(`path escape: ${p}`);
  return r;
};

const transactionPath = path.resolve(args.transaction);
const base = path.dirname(transactionPath);
const transactionBytes = fs.readFileSync(transactionPath);
const tx = JSON.parse(transactionBytes);
if (tx.schema !== 'fia.owned-build-transaction.v1') throw new Error('unexpected transaction schema');
if (!validDigest(tx.identity) || identityOf(tx) !== tx.identity) throw new Error('transaction identity mismatch');

const objectSpecPath = resolveInside(base,args.objects);
const objectSpecBytes = fs.readFileSync(objectSpecPath);
const spec = JSON.parse(objectSpecBytes);
if (spec.schema !== 'fia.registry-admission-objects.v1') throw new Error('unexpected object specification schema');
if (!Array.isArray(spec.objects) || !spec.objects.length) throw new Error('objects required');

const byDigest = new Map();
for (const entry of spec.objects) {
  if (!entry || typeof entry !== 'object') throw new Error('invalid object entry');
  const file = resolveInside(base,entry.path);
  const bytes = fs.readFileSync(file);
  const actual = digest(bytes);
  if (entry.digest && entry.digest !== actual) throw new Error(`digest mismatch: ${entry.path}`);
  if (entry.size !== undefined && entry.size !== bytes.length) throw new Error(`size mismatch: ${entry.path}`);
  if (!entry.mediaType || typeof entry.mediaType !== 'string') throw new Error(`mediaType required: ${entry.path}`);
  if (byDigest.has(actual)) throw new Error(`duplicate object digest: ${actual}`);
  byDigest.set(actual,{digest:actual,size:bytes.length,mediaType:entry.mediaType,artifactType:entry.artifactType??null,subject:entry.subject??null,references:[...(entry.references??[])].sort(),role:entry.role??null,path:entry.path});
}
for (const o of byDigest.values()) {
  for (const r of o.references) if (!byDigest.has(r)) throw new Error(`missing referenced object: ${r}`);
  if (o.subject && !byDigest.has(o.subject)) throw new Error(`missing subject object: ${o.subject}`);
}
const roots = [...new Set(spec.roots??[])].sort();
if (!roots.length) throw new Error('roots required');
for (const r of roots) if (!byDigest.has(r)) throw new Error(`missing root: ${r}`);

const reachable = new Set();
const visit = d => { if (reachable.has(d)) return; reachable.add(d); for (const c of byDigest.get(d).references) visit(c); };
for (const r of roots) visit(r);
let changed=true;
while(changed){
  changed=false;
  for(const o of byDigest.values()) if(o.subject&&reachable.has(o.subject)&&!reachable.has(o.digest)){visit(o.digest);changed=true;}
}
if (reachable.size !== byDigest.size) throw new Error('unreachable object present');

const requiredRoles = ['runtime','sbom','provenance','signature','rollback'];
for (const role of requiredRoles) {
  const matches=[...byDigest.values()].filter(o=>o.role===role);
  if(matches.length!==1) throw new Error(`exactly one ${role} object required`);
}
const runtime=[...byDigest.values()].find(o=>o.role==='runtime');
for (const role of ['sbom','provenance','signature']) {
  const o=[...byDigest.values()].find(x=>x.role===role);
  if(o.subject!==runtime.digest) throw new Error(`${role} must subject runtime`);
}
const rollback=[...byDigest.values()].find(o=>o.role==='rollback');
if(!rollback.references.includes(runtime.digest)) throw new Error('rollback must reference runtime');

const objects=[...byDigest.values()].sort((a,b)=>a.digest.localeCompare(b.digest)).map(({path,...o})=>o);
const catalogCore={schema:'foundation.artifact.catalog.v1',roots,objects};
const catalogDigest=digest(Buffer.from(JSON.stringify(catalogCore)));
const exportManifest={schema:'fia.registry-export.v1',catalogDigest,roots,objects:objects.map(o=>({digest:o.digest,size:o.size,mediaType:o.mediaType})),formats:['oci-layout','canonical-json'],portable:true};
exportManifest.identity=identityOf(exportManifest);
const rollbackManifest={schema:'fia.rollback-bundle.v1',transactionIdentity:tx.identity,catalogDigest,runtimeDigest:runtime.digest,rollbackObjectDigest:rollback.digest,requiredObjects:objects.map(o=>o.digest),complete:true};
rollbackManifest.identity=identityOf(rollbackManifest);
const record={schema:'fia.registered-owned-build.v1',transaction:{identity:tx.identity,sha256:digest(transactionBytes),size:transactionBytes.length},objectSpecification:{sha256:digest(objectSpecBytes),size:objectSpecBytes.length},catalog:{...catalogCore,catalogDigest},exportManifest,rollbackManifest,policy:{contentAddressed:true,completeClosure:true,providerAuthority:false,appendOnlyAdmission:true,overwriteExisting:false}};
record.identity=identityOf(record);
fs.writeFileSync(args.output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(record.identity);
