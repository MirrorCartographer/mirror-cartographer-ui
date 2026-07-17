#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.release-bundle.v1';
const sha256 = b => createHash('sha256').update(b).digest('hex');
const canonical = value => JSON.stringify(sort(value));
function sort(v){ if(Array.isArray(v)) return v.map(sort); if(v&&typeof v==='object'){return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]))} return v; }
function fail(msg){ throw new Error(msg); }
function artifactDigest(id){ if(!/^sha256:[0-9a-f]{64}$/.test(id||'')) fail('invalid artifact identity'); return id.slice(7); }
function safeRel(p){ if(typeof p!=='string'||!p||path.isAbsolute(p)||p.includes('\\')) fail(`unsafe path: ${p}`); const n=path.posix.normalize(p); if(n==='..'||n.startsWith('../')||n!==p||p.includes('\0')) fail(`unsafe path: ${p}`); return p; }
async function readJson(file){ return JSON.parse(await readFile(file,'utf8')); }
async function exclusiveWrite(file, bytes){ await mkdir(path.dirname(file),{recursive:true}); await writeFile(file,bytes,{flag:'wx',mode:0o600}); }

export async function createBundle({store,artifact,evidence=[],output}){
  const digest=artifactDigest(artifact);
  const descriptorPath=path.join(store,'releases',`${digest}.json`);
  const descriptorBytes=await readFile(descriptorPath);
  const descriptor=JSON.parse(descriptorBytes);
  if(descriptor.artifact!==artifact) fail('release descriptor artifact mismatch');
  const entries=[];
  for(const file of descriptor.files||[]){
    safeRel(file.path);
    if(!/^sha256:[0-9a-f]{64}$/.test(file.blob||'')) fail('invalid blob identity');
    const bd=file.blob.slice(7);
    const blobPath=path.join(store,'blobs','sha256',bd.slice(0,2),bd);
    const bytes=await readFile(blobPath);
    if(sha256(bytes)!==bd||bytes.length!==file.size) fail(`corrupt blob: ${file.path}`);
    entries.push({kind:'artifact',path:file.path,size:bytes.length,sha256:bd,data:bytes.toString('base64')});
  }
  for(const evidencePath of evidence){
    const bytes=await readFile(evidencePath);
    const parsed=JSON.parse(bytes);
    entries.push({kind:'evidence',path:safeRel(path.posix.join('evidence',path.basename(evidencePath))),size:bytes.length,sha256:sha256(bytes),schema:parsed.schema??null,data:bytes.toString('base64')});
  }
  entries.sort((a,b)=>a.kind.localeCompare(b.kind)||a.path.localeCompare(b.path));
  const core={schema:SCHEMA,artifact,releaseDescriptor:{sha256:sha256(descriptorBytes),data:descriptorBytes.toString('base64')},entries};
  const bundleIdentity=`sha256:${sha256(Buffer.from(canonical(core)))}`;
  const bundle={...core,bundle:bundleIdentity};
  const bytes=Buffer.from(canonical(bundle)+'\n');
  await exclusiveWrite(output,bytes);
  return {schema:SCHEMA,artifact,bundle:bundleIdentity,entries:entries.length,output};
}

export async function verifyBundle({input}){
  const bytes=await readFile(input); const bundle=JSON.parse(bytes);
  if(bundle.schema!==SCHEMA) fail('unsupported bundle schema');
  artifactDigest(bundle.artifact);
  const {bundle:claimed,...core}=bundle;
  const actual=`sha256:${sha256(Buffer.from(canonical(core)))}`;
  if(claimed!==actual) fail('bundle identity mismatch');
  const seen=new Set();
  for(const e of bundle.entries||[]){
    safeRel(e.path); if(seen.has(`${e.kind}:${e.path}`)) fail('duplicate bundle entry'); seen.add(`${e.kind}:${e.path}`);
    const data=Buffer.from(e.data,'base64');
    if(data.length!==e.size||sha256(data)!==e.sha256) fail(`entry integrity mismatch: ${e.path}`);
  }
  const descriptorBytes=Buffer.from(bundle.releaseDescriptor.data,'base64');
  if(sha256(descriptorBytes)!==bundle.releaseDescriptor.sha256) fail('release descriptor integrity mismatch');
  const descriptor=JSON.parse(descriptorBytes);
  if(descriptor.artifact!==bundle.artifact) fail('embedded release descriptor mismatch');
  return {schema:'fia.release-bundle-verification.v1',artifact:bundle.artifact,bundle:actual,entries:bundle.entries.length};
}

export async function importBundle({input,store,evidenceDir}){
  const verification=await verifyBundle({input});
  const bundle=await readJson(input); const digest=artifactDigest(bundle.artifact);
  for(const e of bundle.entries){
    const data=Buffer.from(e.data,'base64');
    if(e.kind==='artifact'){
      const dest=path.join(store,'blobs','sha256',e.sha256.slice(0,2),e.sha256);
      await mkdir(path.dirname(dest),{recursive:true});
      try { await writeFile(dest,data,{flag:'wx',mode:0o444}); } catch(err){ if(err.code!=='EEXIST') throw err; const existing=await readFile(dest); if(sha256(existing)!==e.sha256) fail(`existing blob corruption: ${e.path}`); }
    } else if(e.kind==='evidence'&&evidenceDir){
      const dest=path.join(evidenceDir,path.basename(e.path));
      await exclusiveWrite(dest,data);
    }
  }
  const descriptor=Buffer.from(bundle.releaseDescriptor.data,'base64');
  const releasePath=path.join(store,'releases',`${digest}.json`); await mkdir(path.dirname(releasePath),{recursive:true});
  try { await writeFile(releasePath,descriptor,{flag:'wx',mode:0o444}); } catch(err){ if(err.code!=='EEXIST') throw err; const existing=await readFile(releasePath); if(sha256(existing)!==sha256(descriptor)) fail('release descriptor collision'); }
  return {...verification,imported:true};
}

function args(argv){ const out={evidence:[]}; for(let i=0;i<argv.length;i++){const x=argv[i]; if(x==='--evidence') out.evidence.push(argv[++i]); else if(x.startsWith('--')) out[x.slice(2)]=argv[++i]; else if(!out.command) out.command=x; else fail(`unexpected argument: ${x}`);} return out; }
if(import.meta.url===`file://${process.argv[1]}`){
  const a=args(process.argv.slice(2));
  const op=a.command==='create'?createBundle:a.command==='verify'?verifyBundle:a.command==='import'?importBundle:null;
  if(!op) fail('usage: bundle-release.mjs <create|verify|import> ...');
  op(a).then(r=>console.log(canonical(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
