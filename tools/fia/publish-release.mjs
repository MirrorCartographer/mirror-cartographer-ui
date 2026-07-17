#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.publication-transaction.v1';
const ARTIFACT_RE = /^sha256:[a-f0-9]{64}$/;
function canonical(value){if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function atomicWrite(path,text){mkdirSync(dirname(path),{recursive:true});const temp=`${path}.tmp-${process.pid}-${randomUUID()}`;writeFileSync(temp,text,{flag:'wx'});renameSync(temp,path);}

async function createStaticRuntime(options){
  const root=resolve(options.root); if(!existsSync(root)||!statSync(root).isDirectory())throw new Error('runtime root is unavailable');
  const artifact=options.artifact; if(!ARTIFACT_RE.test(artifact??''))throw new Error('runtime artifact identity is invalid');
  const server=createServer((request,response)=>{const method=request.method??'GET';if(method!=='GET'&&method!=='HEAD'){response.writeHead(405,{'Cache-Control':'no-store','Allow':'GET, HEAD'});response.end();return;}const path=new URL(request.url??'/','http://runtime.invalid').pathname;let body;if(path==='/healthz')body={schema:'fia.runtime-health.v1',status:'ok'};else if(path==='/fia-artifact')body={schema:'fia.runtime-artifact.v1',artifact};else{response.writeHead(404,{'Cache-Control':'no-store'});response.end();return;}const payload=`${JSON.stringify(body)}\n`;response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(payload),'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});method==='HEAD'?response.end():response.end(payload);});
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(options.port??0,options.host??'127.0.0.1',res);});
  return{address:server.address(),close:()=>new Promise((res,rej)=>server.close(e=>e?rej(e):res()))};
}
async function verifyRuntime({url,artifact,timeout=5000}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const [healthResponse,identityResponse]=await Promise.all([fetch(new URL('/healthz',url),{redirect:'error',signal:controller.signal}),fetch(new URL('/fia-artifact',url),{redirect:'error',signal:controller.signal})]);const health=await healthResponse.json();const identity=await identityResponse.json();if(healthResponse.status!==200||health.schema!=='fia.runtime-health.v1'||health.status!=='ok')throw new Error('runtime health verification failed');if(identityResponse.status!==200||identity.schema!=='fia.runtime-artifact.v1')throw new Error('runtime artifact endpoint verification failed');if(identity.artifact!==artifact)throw new Error(`served artifact mismatch: expected ${artifact}, received ${identity.artifact??'missing'}`);const evidence={schema:'fia.runtime-verification.v1',url:new URL(url).origin,artifact,health:'ok'};return{...evidence,verification:`sha256:${sha256(canonical(evidence))}`};}finally{clearTimeout(timer);}}

async function defaultDeploy(options){const { deploy }=await import('./deploy-release.mjs');return deploy(options);}
async function defaultRollback(options){const { rollback }=await import('./deploy-release.mjs');return rollback(options);}

export async function publishRelease(options){
  const artifact=options.artifact;
  if(!ARTIFACT_RE.test(artifact??''))throw new Error('artifact identity must be sha256:<64 lowercase hex characters>');
  const root=resolve(options.root??'.fia-deploy');
  const deployFn=options.deployFn??defaultDeploy;
  const rollbackFn=options.rollbackFn??defaultRollback;
  const runtimeFactory=options.runtimeFactory??createStaticRuntime;
  const verifier=options.verifier??verifyRuntime;
  const startedAt=new Date().toISOString();
  let deployment;
  let runtime;
  try{
    deployment=await deployFn({artifact,store:options.store??'.fia-store',root,healthCommand:options.healthCommand??null,retain:options.retain??3});
    runtime=await runtimeFactory({root:join(root,'current'),host:options.host??'127.0.0.1',port:options.port??0,spa:Boolean(options.spa),artifact:options.runtimeArtifact??artifact});
    const address=runtime.address;
    if(!address||typeof address!=='object')throw new Error('candidate runtime did not expose a TCP address');
    const verification=await verifier({url:`http://${address.address.includes(':')?'[::1]':address.address}:${address.port}`,artifact,timeout:options.timeout??5000});
    await runtime.close(); runtime=null;
    const record={schema:SCHEMA,state:'verified-and-promoted',artifact,previousArtifact:deployment.previousArtifact??null,deployment:deployment.deployment??null,verification:verification.verification,startedAt};
    const text=`${canonical(record)}\n`;const identity=sha256(text);atomicWrite(join(root,'publication-history',`${identity}.json`),text);
    return{...record,publication:`sha256:${identity}`};
  }catch(error){
    if(runtime){try{await runtime.close();}catch{}}
    let rollback=null;
    if(deployment?.previousArtifact){
      try{rollback=await rollbackFn({root,artifact:deployment.previousArtifact});}catch(rollbackError){error.rollbackError=rollbackError;}
    }
    const record={schema:SCHEMA,state:rollback?'rolled-back':'failed',artifact,previousArtifact:deployment?.previousArtifact??null,error:String(error.message??error),rollbackArtifact:rollback?.artifact??null,startedAt};
    const text=`${canonical(record)}\n`;const identity=sha256(text);atomicWrite(join(root,'publication-history',`${identity}.json`),text);
    const wrapped=new Error(`${record.error}${error.rollbackError?`; rollback failed: ${error.rollbackError.message}`:''}`);
    wrapped.publication={...record,publication:`sha256:${identity}`};
    throw wrapped;
  }
}

function parseArgs(argv){const args={};for(let i=0;i<argv.length;i+=1){const token=argv[i];if(!token.startsWith('--'))throw new Error(`Unknown argument: ${token}`);args[token.slice(2)]=argv[++i];}return args;}
if(import.meta.url===new URL(process.argv[1],'file:').href){const flags=parseArgs(process.argv.slice(2));publishRelease({artifact:flags.artifact,store:flags.store,root:flags.root,host:flags.host,port:flags.port?Number(flags.port):0,spa:flags.spa==='true',timeout:flags.timeout?Number(flags.timeout):5000,retain:flags.retain?Number(flags.retain):3}).then(result=>process.stdout.write(`${JSON.stringify(result)}\n`)).catch(error=>{process.stderr.write(`${JSON.stringify(error.publication??{error:error.message})}\n`);process.exitCode=1;});}
