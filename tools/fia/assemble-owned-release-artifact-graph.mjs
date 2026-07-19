#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile, open } from 'node:fs/promises';
import path from 'node:path';

const REQUEST_SCHEMA='fia.owned-release-artifact-graph-request.v1';
const OUTPUT_SCHEMA='fia.owned-release-artifact-graph.v1';
const OCI_LAYOUT='1.0.0';
const SHA=/^[a-f0-9]{64}$/;
const ROLES=new Set(['release','route-manifest','offline-bundle','offline-verification','deployment-bundle','restore','installation','live-commit','sbom','provenance','signature','rollback']);
const EDGE_TYPES=new Set(['contains','derived-from','verified-by','describes','signed-by','rolls-back-to']);

function fail(m){throw new Error(m)}
function sha(b){return createHash('sha256').update(b).digest('hex')}
function canonical(v){
  if(Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if(v&&typeof v==='object') return `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`;
  return JSON.stringify(v);
}
function exactKeys(o, keys, where){
  if(!o||typeof o!=='object'||Array.isArray(o)) fail(`${where} must be object`);
  const a=Object.keys(o).sort(), b=[...keys].sort();
  if(a.join('\0')!==b.join('\0')) fail(`${where} fields mismatch: ${a.join(',')}`);
}
function safeRel(p,where){
  if(typeof p!=='string'||!p||p.includes('\\')||p.includes('\0')||path.posix.isAbsolute(p)||p.includes('?')||p.includes('#')) fail(`${where} unsafe path`);
  const n=path.posix.normalize(p);
  if(n!==p||n==='..'||n.startsWith('../')) fail(`${where} non-canonical path`);
  return p;
}
async function exclusiveJson(file,obj){
  const h=await open(file,'wx');
  try{await h.writeFile(canonical(obj)+'\n');await h.sync();}finally{await h.close()}
}
async function main(){
  const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?(a.push([x.slice(2),all[i+1]]),a):a,[]));
  for(const k of ['request','output','exportDir']) if(!args[k]) fail(`missing --${k}`);
  const reqBytes=await readFile(args.request); const req=JSON.parse(reqBytes);
  exactKeys(req,['schema','releaseIdentity','nodes','edges','requiredRoles','rollbackNode'],'request');
  if(req.schema!==REQUEST_SCHEMA) fail('request schema mismatch');
  if(!SHA.test(req.releaseIdentity)) fail('invalid releaseIdentity');
  if(!Array.isArray(req.nodes)||req.nodes.length<2) fail('nodes must contain at least two entries');
  if(!Array.isArray(req.edges)||!Array.isArray(req.requiredRoles)) fail('edges/requiredRoles must be arrays');
  if(await stat(args.exportDir).then(()=>true,()=>false)) fail('exportDir already exists');
  if(await stat(args.output).then(()=>true,()=>false)) fail('output already exists');

  const base=path.dirname(path.resolve(args.request)); const nodes=[]; const names=new Set(); const logical=new Map();
  for(let i=0;i<req.nodes.length;i++){
    const n=req.nodes[i]; exactKeys(n,['name','role','path','schema','identity','releaseIdentity','sha256','size'],'node');
    if(typeof n.name!=='string'||!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(n.name)||names.has(n.name)) fail('invalid or duplicate node name'); names.add(n.name);
    if(!ROLES.has(n.role)) fail(`unsupported role ${n.role}`); safeRel(n.path,'node.path');
    if(typeof n.schema!=='string'||!n.schema.startsWith('fia.')) fail('invalid node schema');
    if(!SHA.test(n.identity)||!SHA.test(n.sha256)||!Number.isSafeInteger(n.size)||n.size<0) fail('invalid node identity metadata');
    if(n.releaseIdentity!==req.releaseIdentity) fail(`cross-release node ${n.name}`);
    const file=path.resolve(base,n.path); if(!file.startsWith(base+path.sep)) fail('node path escaped request directory');
    const s=await stat(file); if(!s.isFile()) fail(`node ${n.name} is not regular file`);
    const bytes=await readFile(file); const digest=sha(bytes);
    if(digest!==n.sha256||bytes.length!==n.size) fail(`artifact mismatch for ${n.name}`);
    const parsed=JSON.parse(bytes);
    if(parsed.schema!==n.schema) fail(`schema mismatch for ${n.name}`);
    if(parsed.identity!==n.identity) fail(`identity mismatch for ${n.name}`);
    if(parsed.releaseIdentity!==undefined&&parsed.releaseIdentity!==req.releaseIdentity) fail(`embedded cross-release identity for ${n.name}`);
    const key=`${n.schema}:${n.identity}`; const prior=logical.get(key);
    if(prior&&prior!==digest) fail(`duplicate logical identity with different bytes: ${key}`); logical.set(key,digest);
    const nodeId=sha(Buffer.from(canonical({schema:n.schema,identity:n.identity,artifactSha256:digest,size:bytes.length,role:n.role,releaseIdentity:req.releaseIdentity})));
    nodes.push({...n,nodeId,artifactSha256:digest,artifactSize:bytes.length,sourcePath:n.path,bytes});
  }
  const byName=new Map(nodes.map(n=>[n.name,n]));
  const edges=req.edges.map((e,i)=>{exactKeys(e,['from','to','type'],`edge ${i}`);if(!byName.has(e.from)||!byName.has(e.to)||!EDGE_TYPES.has(e.type)||e.from===e.to) fail(`invalid edge ${i}`);return {from:byName.get(e.from).nodeId,to:byName.get(e.to).nodeId,type:e.type};});
  const edgeKeys=new Set(); for(const e of edges){const k=canonical(e);if(edgeKeys.has(k)) fail('duplicate edge');edgeKeys.add(k)}
  for(const role of req.requiredRoles){if(!ROLES.has(role)||!nodes.some(n=>n.role===role)) fail(`missing required role ${role}`)}
  const releaseNodes=nodes.filter(n=>n.role==='release'); if(releaseNodes.length!==1) fail('exactly one release node required');
  if(!byName.has(req.rollbackNode)||byName.get(req.rollbackNode).role!=='rollback') fail('rollbackNode must name rollback role');
  const root=releaseNodes[0].nodeId; const adj=new Map(); for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e.to)}
  const seen=new Set([root]), q=[root]; while(q.length){for(const t of adj.get(q.shift())||[])if(!seen.has(t)){seen.add(t);q.push(t)}}
  if(seen.size!==nodes.length) fail('artifact graph is not fully reachable from release node');
  for(const n of nodes.filter(n=>n.role==='signature')) if(!edges.some(e=>e.type==='signed-by'&&e.to===n.nodeId)) fail(`orphan signature ${n.name}`);
  if(!edges.some(e=>e.type==='rolls-back-to'&&e.to===byName.get(req.rollbackNode).nodeId)) fail('rollback lineage edge missing');

  const publicNodes=nodes.map(({bytes,...n})=>n).sort((a,b)=>a.nodeId.localeCompare(b.nodeId)); edges.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const contentIdentity=sha(Buffer.from(canonical({releaseIdentity:req.releaseIdentity,nodes:publicNodes.map(n=>({nodeId:n.nodeId,role:n.role,schema:n.schema,identity:n.identity,artifactSha256:n.artifactSha256,artifactSize:n.artifactSize})),edges,rollbackNodeId:byName.get(req.rollbackNode).nodeId})));
  const graph={schema:OUTPUT_SCHEMA,releaseIdentity:req.releaseIdentity,contentIdentity,nodes:publicNodes,edges,rootNodeId:root,rollbackNodeId:byName.get(req.rollbackNode).nodeId,policy:{completeReachability:true,exactArtifactBytes:true,crossReleaseEdges:false,signatureCoverage:true,rollbackLineage:true}};
  graph.identity=sha(Buffer.from(canonical(graph)));

  const stage=args.exportDir+`.staging-${process.pid}`; await rm(stage,{recursive:true,force:true}); await mkdir(path.join(stage,'blobs','sha256'),{recursive:true});
  try{
    for(const n of nodes) await writeFile(path.join(stage,'blobs','sha256',n.artifactSha256),n.bytes,{flag:'wx'}).catch(async e=>{if(e.code!=='EEXIST')throw e; const b=await readFile(path.join(stage,'blobs','sha256',n.artifactSha256)); if(sha(b)!==n.artifactSha256) fail('blob collision')});
    const graphBytes=Buffer.from(canonical(graph)+'\n'); const graphDigest=sha(graphBytes); await writeFile(path.join(stage,'blobs','sha256',graphDigest),graphBytes,{flag:'wx'});
    const manifest={schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.fia.release-artifact-graph.v1+json',digest:`sha256:${graphDigest}`,size:graphBytes.length},layers:publicNodes.map(n=>({mediaType:'application/vnd.fia.artifact.v1+json',digest:`sha256:${n.artifactSha256}`,size:n.artifactSize,annotations:{'org.opencontainers.image.title':n.name,'fia.role':n.role,'fia.node.id':n.nodeId}}))};
    const manifestBytes=Buffer.from(canonical(manifest)+'\n'); const manifestDigest=sha(manifestBytes); await writeFile(path.join(stage,'blobs','sha256',manifestDigest),manifestBytes,{flag:'wx'});
    await writeFile(path.join(stage,'oci-layout'),canonical({imageLayoutVersion:OCI_LAYOUT})+'\n',{flag:'wx'});
    await writeFile(path.join(stage,'index.json'),canonical({schemaVersion:2,manifests:[{mediaType:manifest.mediaType,digest:`sha256:${manifestDigest}`,size:manifestBytes.length,annotations:{'org.opencontainers.image.ref.name':req.releaseIdentity,'fia.graph.identity':graph.identity}}]})+'\n',{flag:'wx'});
    await rename(stage,args.exportDir);
    await exclusiveJson(args.output,{...graph,export:{format:'oci-layout',manifestDigest:`sha256:${manifestDigest}`,graphDigest:`sha256:${graphDigest}`}});
  }catch(e){await rm(stage,{recursive:true,force:true});throw e}
  process.stdout.write(JSON.stringify({schema:OUTPUT_SCHEMA,identity:graph.identity,contentIdentity,nodes:nodes.length,edges:edges.length})+'\n');
}
main().catch(e=>{console.error(e.message);process.exit(1)});
