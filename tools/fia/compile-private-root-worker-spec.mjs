#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA='fia.private-root-worker-spec.v1';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const stable=v=>JSON.stringify(canonical(v));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw new Error(m)};
async function ensureAbsent(p){try{await stat(p);fail(`destination already exists: ${p}`)}catch(e){if(e.code!=='ENOENT')throw e}}
function parseJson(name,value){try{return JSON.parse(value)}catch{fail(`invalid JSON for --${name}`)}}
function parseArgs(argv){const o={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)fail('arguments must be --name value pairs');o[argv[i].slice(2)]=argv[i+1]}for(const k of ['source','workspace','command','output'])if(!o[k])fail(`missing --${k}`);return{source:o.source,workspace:o.workspace,command:parseJson('command',o.command),output:o.output,bwrap:o.bwrap??'bwrap',readOnly:parseJson('readOnly',o.readOnly??'[]'),writable:parseJson('writable',o.writable??'[]')}}
function validateContainerPath(p,label){if(typeof p!=='string'||!p.startsWith('/')||p.includes('\0')||p.split('/').includes('..'))fail(`invalid ${label} container path: ${p}`);return path.posix.normalize(p)}
async function identity(file){const b=await readFile(file);return{sha256:sha256(b),bytes:b.length}}
function resolveBinary(name,runner=spawnSync){const r=runner('sh',['-c','command -v "$1"','fia-lookup',name],{encoding:'utf8'});if(r.status!==0||!r.stdout.trim())fail(`required executable unavailable: ${name}`);return r.stdout.trim()}
async function inventory(root){const out=[];async function walk(dir,rel=''){for(const name of (await readdir(dir)).sort()){const abs=path.join(dir,name),rp=rel?`${rel}/${name}`:name,s=await lstat(abs);if(s.isSymbolicLink())fail(`symlink is not allowed: ${rp}`);if(s.isDirectory()){out.push({path:rp,type:'directory',mode:s.mode&0o777});await walk(abs,rp)}else if(s.isFile()){const b=await readFile(abs);out.push({path:rp,type:'file',mode:s.mode&0o777,size:b.length,sha256:sha256(b)})}else fail(`unsupported filesystem entry: ${rp}`)}}await walk(root);return out}
function normalizeMounts(items,kind){if(!Array.isArray(items))fail(`${kind} mounts must be an array`);return items.map((m,i)=>{if(!m||typeof m!=='object')fail(`invalid ${kind} mount at ${i}`);const host=path.resolve(m.host??''),container=validateContainerPath(m.container,kind),hostRef=m.hostRef??`${kind}-${i}`;if(typeof hostRef!=='string'||!hostRef)fail(`invalid ${kind} hostRef at ${i}`);return{host,hostRef,container}}).sort((a,b)=>a.container.localeCompare(b.container)||a.hostRef.localeCompare(b.hostRef))}
function rejectOverlaps(ro,rw){const all=[...ro.map(x=>({...x,kind:'ro'})),...rw.map(x=>({...x,kind:'rw'}))];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i].container,b=all[j].container;if(a===b||a.startsWith(`${b}/`)||b.startsWith(`${a}/`))fail(`overlapping container mounts: ${a} and ${b}`)}}
function launcher(spec){const a=[spec.bwrap.executable,'--die-with-parent','--new-session','--unshare-user','--unshare-pid','--unshare-net','--unshare-ipc','--unshare-uts','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--dir','/run','--setenv','HOME','/workspace/home','--setenv','TMPDIR','/tmp','--setenv','LANG','C.UTF-8','--setenv','LC_ALL','C.UTF-8','--setenv','TZ','UTC'];for(const m of spec.mounts.readOnly)a.push('--ro-bind',`{${m.hostRef}}`,m.container);for(const m of spec.mounts.writable)a.push('--bind',`{${m.hostRef}}`,m.container);a.push('--chdir','/workspace','--',...spec.command);return a}
export async function compilePrivateRootWorkerSpec(options,hooks={}){
 const source=path.resolve(options.source),workspace=path.resolve(options.workspace),output=path.resolve(options.output);await ensureAbsent(output);
 if(!Array.isArray(options.command)||!options.command.length||options.command.some(x=>typeof x!=='string'||x.includes('\0')))fail('command must be a non-empty JSON string array');
 const ss=await stat(source).catch(()=>null),ws=await stat(workspace).catch(()=>null);if(!ss?.isDirectory())fail('source must be a directory');if(!ws?.isDirectory())fail('workspace must be a directory');
 const readOnly=normalizeMounts([{host:source,hostRef:'source',container:'/source'},...(options.readOnly??[])],'read-only');
 const writable=normalizeMounts([{host:workspace,hostRef:'workspace',container:'/workspace'},...(options.writable??[])],'writable');rejectOverlaps(readOnly,writable);
 const resolve=hooks.resolveBinary??resolveBinary,bwrapPath=resolve(options.bwrap??'bwrap');const bwrapIdentity=await identity(bwrapPath);
 const probe=hooks.probe??((bin)=>spawnSync(bin,['--unshare-user','--unshare-pid','--unshare-net','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--ro-bind','/','/host','--','/host/bin/true'],{encoding:'utf8'}));const p=probe(bwrapPath);if(p.status!==0)fail(`bubblewrap isolation probe failed: ${(p.stderr??'').trim()}`);
 const mounted=[];for(const m of [...readOnly,...writable]){const s=await stat(m.host).catch(()=>null);if(!s)fail(`mount source unavailable: ${m.host}`);mounted.push({hostRef:m.hostRef,container:m.container,hostType:s.isDirectory()?'directory':s.isFile()?'file':'unsupported',inventoryIdentity:s.isDirectory()?sha256(Buffer.from(stable(await inventory(m.host)))):(await identity(m.host)).sha256});if(mounted.at(-1).hostType==='unsupported')fail(`unsupported mount source: ${m.host}`)}
 const spec={schema:SCHEMA,policy:{filesystemRoot:'bubblewrap-private-root',network:'new-empty-namespace',process:'new-pid-namespace',devices:'minimal-dev',proc:'private-proc',tmp:'private-tmpfs',environment:'fixed-minimal',mountOverlap:'rejected'},bwrap:{executable:options.bwrap??'bwrap',...bwrapIdentity,probe:'passed'},command:options.command,mounts:{readOnly:mounted.filter(m=>readOnly.some(x=>x.hostRef===m.hostRef&&x.container===m.container)),writable:mounted.filter(m=>writable.some(x=>x.hostRef===m.hostRef&&x.container===m.container))}};
 spec.launcher=launcher(spec);spec.identity=sha256(Buffer.from(stable(spec)));await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(spec,null,2)}\n`,{flag:'wx'});return spec
}
if(import.meta.url===`file://${process.argv[1]}`)compilePrivateRootWorkerSpec(parseArgs(process.argv)).then(r=>process.stdout.write(`${r.identity}\n`)).catch(e=>{console.error(e.message);process.exitCode=1});
