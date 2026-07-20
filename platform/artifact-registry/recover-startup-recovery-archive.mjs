#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { open, readFile, readdir, rename, rm, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';

const JOURNAL_SCHEMA='foundation.artifact.registry.startup-recovery-archive-journal.v1';
const INDEX_SCHEMA='foundation.artifact.registry.startup-recovery-archive-index.v1';
const OUT_SCHEMA='foundation.artifact.registry.startup-recovery-archive-recovery.v1';
const ID_RE=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST_RE=/^sha256:[0-9a-f]{64}$/;

function fail(m){throw new Error(m)}
function canonical(v){if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k)=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function shaBytes(b){return `sha256:${createHash('sha256').update(b).digest('hex')}`}
function shaObj(v){return shaBytes(Buffer.from(canonical(v)))}
async function readJson(p){return JSON.parse(await readFile(p,'utf8'))}
async function exists(p){try{await stat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function fsyncDir(p){const h=await open(p,'r');try{await h.sync()}finally{await h.close()}}
async function writeExclusive(p,bytes){const h=await open(p,'wx',0o600);try{await h.writeFile(bytes);await h.sync()}finally{await h.close()}await fsyncDir(path.dirname(p))}
async function listRegularFiles(root){const out=[];async function walk(dir,rel=''){for(const ent of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const r=rel?`${rel}/${ent.name}`:ent.name;const p=path.join(dir,ent.name);if(ent.isSymbolicLink())fail(`symbolic link rejected: ${r}`);if(ent.isDirectory())await walk(p,r);else if(ent.isFile()){const b=await readFile(p);out.push({path:r,size:b.length,sha256:shaBytes(b)})}else fail(`unsupported entry: ${r}`)}}await walk(root);return out}
function parseArgs(argv){const out={};for(let i=2;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])fail('expected --key value arguments');out[argv[i].slice(2)]=argv[i+1]}if(!out.registry||!out.output)fail('usage: --registry <dir> --output <file>');return out}
function validateJournal(j){const keys=['archiveIndexSha256','createdAt','moveIntents','movedTransactionIds','phase','records','schema','transactionId'];if(canonical(Object.keys(j).sort())!==canonical(keys))fail('invalid journal fields');if(j.schema!==JOURNAL_SCHEMA)fail('invalid journal schema');if(!ID_RE.test(j.transactionId))fail('invalid journal transactionId');if(!['prepared','moving','index-published','finalizing'].includes(j.phase))fail('invalid journal phase');if(!DIGEST_RE.test(j.archiveIndexSha256))fail('invalid archive index digest');if(!Array.isArray(j.records)||j.records.length===0)fail('journal records required');const ids=new Set();for(const r of j.records){if(canonical(Object.keys(r).sort())!==canonical(['inventorySha256','transactionId']))fail('invalid journal record');if(!ID_RE.test(r.transactionId)||ids.has(r.transactionId))fail('invalid or duplicate record id');if(!DIGEST_RE.test(r.inventorySha256))fail('invalid inventory digest');ids.add(r.transactionId)}for(const field of ['moveIntents','movedTransactionIds']){if(!Array.isArray(j[field]))fail(`${field} must be array`);for(const id of j[field])if(!ids.has(id))fail(`${field} references unknown transaction`)}for(const id of j.movedTransactionIds)if(!j.moveIntents.includes(id))fail('moved transaction lacks intent');return ids}
function validateIndex(i,expected){if(i.schema!==INDEX_SCHEMA)fail('invalid archive index schema');if(!Array.isArray(i.records))fail('invalid archive index records');const normalized=i.records.map(r=>({transactionId:r.transactionId,inventorySha256:r.inventorySha256})).sort((a,b)=>a.transactionId.localeCompare(b.transactionId));const wanted=expected.map(r=>({transactionId:r.transactionId,inventorySha256:r.inventorySha256})).sort((a,b)=>a.transactionId.localeCompare(b.transactionId));if(canonical(normalized)!==canonical(wanted))fail('archive index records mismatch');const body={schema:i.schema,records:normalized};if(i.identity!==shaObj(body))fail('archive index identity mismatch')}
async function locationState(paths,id){const active=await exists(path.join(paths.active,id));const quarantine=await exists(path.join(paths.quarantine,id));const archived=await exists(path.join(paths.archived,id));const count=[active,quarantine,archived].filter(Boolean).length;if(count!==1)fail(`transaction ${id} present in ${count} locations`);return active?'active':quarantine?'quarantine':'archived'}
async function verifyInventory(dir,expected){const inv=await listRegularFiles(dir);const digest=shaObj(inv);if(digest!==expected)fail(`inventory mismatch for ${path.basename(dir)}`);return inv}

export async function recoverArchive({registry,output}){
 const paths={active:path.join(registry,'transactions'),archiveRoot:path.join(registry,'startup-recovery-archive'),quarantine:path.join(registry,'startup-recovery-archive','quarantine'),archived:path.join(registry,'startup-recovery-archive','transactions'),journal:path.join(registry,'startup-recovery-archive','journal.json'),index:path.join(registry,'startup-recovery-archive','index.json')};
 if(await exists(output))fail('output already exists');
 const jBytes=await readFile(paths.journal);const journal=JSON.parse(jBytes);validateJournal(journal);
 await mkdir(paths.active,{recursive:true});await mkdir(paths.quarantine,{recursive:true});await mkdir(paths.archived,{recursive:true});
 const indexExists=await exists(paths.index);let action;
 if(indexExists){const iBytes=await readFile(paths.index);if(shaBytes(iBytes)!==journal.archiveIndexSha256)fail('archive index digest mismatch');const index=JSON.parse(iBytes);validateIndex(index,journal.records);action='finalized-post-commit'}else{if(['index-published','finalizing'].includes(journal.phase))fail('post-commit journal missing archive index');action='rolled-back-pre-commit'}
 const before=[];for(const r of journal.records){const loc=await locationState(paths,r.transactionId);before.push({transactionId:r.transactionId,location:loc});const dir=path.join(loc==='active'?paths.active:loc==='quarantine'?paths.quarantine:paths.archived,r.transactionId);await verifyInventory(dir,r.inventorySha256)}
 if(action==='rolled-back-pre-commit'){
   for(const r of journal.records){const q=path.join(paths.quarantine,r.transactionId),a=path.join(paths.active,r.transactionId),ar=path.join(paths.archived,r.transactionId);if(await exists(ar))fail(`pre-commit record already archived: ${r.transactionId}`);if(await exists(q)){if(await exists(a))fail(`restore collision: ${r.transactionId}`);await rename(q,a)}}
   await fsyncDir(paths.active);await fsyncDir(paths.quarantine);
 }else{
   for(const r of journal.records){const q=path.join(paths.quarantine,r.transactionId),a=path.join(paths.active,r.transactionId),ar=path.join(paths.archived,r.transactionId);if(await exists(ar)){if(await exists(q)||await exists(a))fail(`archive duplication: ${r.transactionId}`);continue}const src=await exists(q)?q:await exists(a)?a:null;if(!src)fail(`archive source missing: ${r.transactionId}`);await rename(src,ar)}
   await fsyncDir(paths.active);await fsyncDir(paths.quarantine);await fsyncDir(paths.archived);
 }
 const after=[];for(const r of journal.records){const loc=await locationState(paths,r.transactionId);const expected=action==='rolled-back-pre-commit'?'active':'archived';if(loc!==expected)fail(`unexpected final location for ${r.transactionId}`);await verifyInventory(path.join(expected==='active'?paths.active:paths.archived,r.transactionId),r.inventorySha256);after.push({transactionId:r.transactionId,location:loc})}
 await rm(paths.journal);await fsyncDir(paths.archiveRoot);
 const content={schema:OUT_SCHEMA,action,journalSha256:shaBytes(jBytes),archiveIndexSha256:indexExists?journal.archiveIndexSha256:null,records:journal.records.slice().sort((a,b)=>a.transactionId.localeCompare(b.transactionId)),before:before.sort((a,b)=>a.transactionId.localeCompare(b.transactionId)),after:after.sort((a,b)=>a.transactionId.localeCompare(b.transactionId)),policy:{duplicateAuthority:'reject',missingAuthority:'reject',symlinks:'reject',commitBoundary:'archive-index-digest'}};
 const evidence={...content,contentIdentity:shaObj(content),operationalId:`archive-recovery-${randomUUID()}`};evidence.identity=shaObj({contentIdentity:evidence.contentIdentity,operationalId:evidence.operationalId});
 await writeExclusive(output,Buffer.from(`${canonical(evidence)}\n`));return evidence;
}
if(import.meta.url===`file://${process.argv[1]}`){recoverArchive(parseArgs(process.argv)).catch(e=>{console.error(e.message);process.exitCode=1})}
