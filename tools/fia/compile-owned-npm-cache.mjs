#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rename, rm, lstat } from 'node:fs/promises';
import { request } from 'node:http';
import { request as requestHttps } from 'node:https';
import os from 'node:os';
import path from 'node:path';

const SCHEMA='fia.owned-npm-cache-manifest.v1';
const sha256=value=>`sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
const canonical=value=>JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
function lockPackages(lock){if(!lock||![2,3].includes(lock.lockfileVersion)||!lock.packages||typeof lock.packages!=='object')fail('package-lock.json must use lockfileVersion 2 or 3 with packages');return Object.entries(lock.packages).filter(([p,v])=>p&&v&&typeof v==='object');}
function verifySri(integrity,bytes){for(const token of String(integrity??'').trim().split(/\s+/).filter(Boolean)){const m=/^(sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(token);if(m&&createHash(m[1]).update(bytes).digest('base64')===m[2])return token;}return null;}
function allowedUrl(url){if(url.username||url.password)fail('dependency URL credentials are forbidden');if(url.protocol==='https:')return;if(url.protocol==='http:'&&['127.0.0.1','localhost','::1'].includes(url.hostname))return;fail(`dependency URL must use HTTPS: ${url.href}`);}
async function fetchBytes(input,{maxBytes=100*1024*1024,redirects=5}={}){const url=new URL(input);allowedUrl(url);return new Promise((resolve,reject)=>{const client=url.protocol==='https:'?requestHttps:request;const req=client(url,{method:'GET',headers:{'user-agent':'fia-owned-cache-compiler/1','accept':'application/octet-stream'}},res=>{if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();if(redirects<=0)return reject(new Error('dependency redirect limit exceeded'));const next=new URL(res.headers.location,url);try{allowedUrl(next);}catch(e){return reject(e);}return fetchBytes(next,{maxBytes,redirects:redirects-1}).then(resolve,reject);}if(res.statusCode!==200){res.resume();return reject(new Error(`dependency fetch failed (${res.statusCode}): ${url.href}`));}const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy(new Error(`dependency exceeds maxBytes: ${url.href}`));return;}chunks.push(chunk);});res.on('end',()=>resolve({bytes:Buffer.concat(chunks),finalUrl:url.href}));});req.on('error',reject);req.end();});}
export async function compileOwnedNpmCache({lockfile='package-lock.json',cacheDir,manifest,maxBytes=100*1024*1024,fetcher=fetchBytes}){
 if(!cacheDir||!manifest)fail('cacheDir and manifest are required');
 const lockRaw=await readFile(path.resolve(lockfile)),lock=JSON.parse(lockRaw),packages=lockPackages(lock);
 const needed=new Map();for(const [pkgPath,pkg] of packages){if(typeof pkg.integrity!=='string')fail(`lockfile dependency missing integrity: ${pkgPath}`);if(typeof pkg.resolved!=='string')fail(`lockfile dependency missing resolved URL: ${pkgPath}`);const prior=needed.get(pkg.integrity);if(prior&&prior.resolved!==pkg.resolved)fail(`same integrity has conflicting resolved URLs: ${pkgPath}`);needed.set(pkg.integrity,{integrity:pkg.integrity,resolved:pkg.resolved,paths:[...(prior?.paths??[]),pkgPath]});}
 const destination=path.resolve(cacheDir),manifestPath=path.resolve(manifest);if(await lstat(destination).catch(()=>null))fail('cacheDir already exists');if(await lstat(manifestPath).catch(()=>null))fail('manifest already exists');
 const temp=await mkdtemp(path.join(os.tmpdir(),'fia-owned-cache-'));
 try{const out=[];for(const item of [...needed.values()].sort((a,b)=>a.integrity.localeCompare(b.integrity))){const {bytes,finalUrl}=await fetcher(item.resolved,{maxBytes});const sri=verifySri(item.integrity,bytes);if(!sri)fail(`lockfile integrity mismatch: ${item.resolved}`);const digest=sha256(bytes),hex=digest.slice(7),rel=`sha256/${hex}.tgz`,absolute=path.join(temp,rel);await mkdir(path.dirname(absolute),{recursive:true});await writeFile(absolute,bytes,{flag:'wx',mode:0o600});out.push({integrity:item.integrity,sha256:digest,bytes:bytes.length,tarball:rel,resolved:item.resolved,finalUrl,lockfilePaths:item.paths.sort()});}
 const core={schema:SCHEMA,lockfile:sha256(lockRaw),packages:out,status:'compiled-and-verified'};const record={...core,manifest:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(manifestPath),{recursive:true});await rename(temp,destination);await writeFile(manifestPath,canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
 }catch(error){await rm(temp,{recursive:true,force:true});throw error;}
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))fail(`unexpected argument: ${t}`);out[t.slice(2)]=argv[++i];}return{lockfile:out.lockfile??'package-lock.json',cacheDir:out.cacheDir,manifest:out.manifest,maxBytes:out.maxBytes?Number(out.maxBytes):100*1024*1024};}
if(import.meta.url===`file://${process.argv[1]}`)compileOwnedNpmCache(args(process.argv.slice(2))).then(r=>console.log(canonical(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
