#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, readdir, mkdir, open } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SCHEMA='fia.owned-deployment-commit.v1';
const INSTALL_SCHEMA='fia.owned-deployment-installation.v1';
const ROUTE_SCHEMA='fia.runtime-route-manifest.v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const canon=v=>JSON.stringify(sort(v));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v}
function fail(m){throw new Error(m)}
function args(){const a=process.argv.slice(2),o={};for(let i=0;i<a.length;i+=2){if(!a[i].startsWith('--')||a[i+1]===undefined)fail('arguments must be --name value pairs');o[a[i].slice(2)]=a[i+1]}return o}
function safeRel(p){if(typeof p!=='string'||!p||p.startsWith('/')||p.includes('\\')||p.split('/').includes('..')||p.includes('\0'))fail(`unsafe path: ${p}`);return p}
async function readJson(path){return JSON.parse(await readFile(path,'utf8'))}
function verifyIdentity(o,label){const claimed=o.identity;const body={...o};delete body.identity;const actual=sha(Buffer.from(canon(body)));if(claimed!==actual)fail(`${label} identity mismatch`);return actual}
async function inventory(root){const out=[];async function walk(dir){for(const n of (await readdir(dir)).sort()){const abs=join(dir,n),st=await lstat(abs),rel=relative(root,abs).split(sep).join('/');if(st.isSymbolicLink())fail(`symlink rejected: ${rel}`);if(st.isDirectory())await walk(abs);else if(st.isFile()){const b=await readFile(abs);out.push({path:rel,mode:st.mode&0o777,size:b.length,sha256:sha(b)})}else fail(`unsupported entry: ${rel}`)}}await walk(root);return out}
async function writeExclusive(path,data){await mkdir(dirname(path),{recursive:true});const h=await open(path,'wx',0o600);try{await h.writeFile(data);await h.sync()}finally{await h.close()}}
async function main(){const a=args();for(const k of ['installation','routeManifest','stateDir','output'])if(!a[k])fail(`missing --${k}`);
 const install=await readJson(a.installation), routes=await readJson(a.routeManifest);
 if(install.schema!==INSTALL_SCHEMA)fail('installation schema mismatch'); if(routes.schema!==ROUTE_SCHEMA)fail('route manifest schema mismatch');
 const installId=verifyIdentity(install,'installation'), routeId=verifyIdentity(routes,'route manifest');
 const state=resolve(a.stateDir), active=join(state,'active'); const activeReal=await realpath(active); const releases=await realpath(join(state,'releases'));
 if(!(activeReal===releases||activeReal.startsWith(releases+sep)))fail('active pointer escapes owned releases');
 const runtime=join(activeReal,'runtime'); const inv=await inventory(runtime);
 if(canon(inv)!==canon(install.installedInventory))fail('active runtime inventory differs from installation evidence');
 const routeFiles=new Set(); for(const r of routes.routes){routeFiles.add(safeRel(r.document));for(const p of r.assets)routeFiles.add(safeRel(p))} if(routes.offlineFallback)routeFiles.add(safeRel(routes.offlineFallback));
 const invMap=new Map(inv.map(x=>[x.path,x])); for(const p of routeFiles)if(!invMap.has(p))fail(`route artifact missing from active runtime: ${p}`);
 const checks={activeWithinOwnedReleases:true,inventoryMatchesInstallation:true,routeClosurePresent:true,noSymlinks:true};
 const body={schema:SCHEMA,releaseIdentity:install.releaseIdentity,installationIdentity:installId,routeManifestIdentity:routeId,activeTarget:relative(state,activeReal).split(sep).join('/'),runtimeInventory:inv,checks,policy:{identity:'sha256-canonical-json',activePointer:'owned-release-only',commitAfter:'filesystem-and-route-closure-verification'}};
 const evidence={...body,identity:sha(Buffer.from(canon(body)))}; await writeExclusive(resolve(a.output),canon(evidence)+'\n'); console.log(JSON.stringify({schema:SCHEMA,identity:evidence.identity,releaseIdentity:evidence.releaseIdentity,files:inv.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
