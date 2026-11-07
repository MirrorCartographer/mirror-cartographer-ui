import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyRestore } from './verify-owned-deployment-restore.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const canonical = v => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
const identity = v => { const c = structuredClone(v); delete c.identity; return sha(Buffer.from(canonical(c))); };
function oct(n,w){ return `${n.toString(8).padStart(w-1,'0')}\0`; }
function header(name,size,mode=0o644){
  const b=Buffer.alloc(512); b.write(name,0,100); b.write(oct(mode,8),100); b.write(oct(0,8),108); b.write(oct(0,8),116); b.write(oct(size,12),124); b.write(oct(0,12),136); b.fill(0x20,148,156); b[156]='0'.charCodeAt(0); b.write('ustar\0',257); b.write('00',263);
  let sum=0; for(const x of b) sum+=x; b.write(`${sum.toString(8).padStart(6,'0')}\0 `,148,8); return b;
}
function archive(entries){ const parts=[]; for(const e of entries){ const data=Buffer.from(e.data); parts.push(header(e.path,data.length,e.mode),data,Buffer.alloc((512-data.length%512)%512)); } parts.push(Buffer.alloc(1024)); return Buffer.concat(parts); }
async function fixture(entries=[{path:'runtime/index.html',data:'<html lang="en"><meta name="viewport" content="width=device-width"></html>',mode:0o644},{path:'commands/rollback.sh',data:'#!/bin/sh\nexit 0\n',mode:0o755}]){
 const dir=await mkdtemp(path.join(os.tmpdir(),'fia-restore-')); const arc=archive(entries); const manifestEntries=entries.map(e=>({path:e.path,mode:e.mode,size:Buffer.byteLength(e.data),sha256:sha(Buffer.from(e.data))}));
 const ev={schema:'fia.owned-deployment-bundle.v1',releaseIdentity:'release-a',archive:{sha256:sha(arc),size:arc.length},manifest:{entries:manifestEntries}}; ev.identity=identity(ev);
 const evidence=path.join(dir,'evidence.json'), archivePath=path.join(dir,'bundle.tar'); await writeFile(evidence,JSON.stringify(ev)); await writeFile(archivePath,arc); return {dir,evidence,archivePath,ev,arc};
}

test('restores exact archive bytes and emits deterministic evidence', async()=>{ const a=await fixture(), b=await fixture(); try { const ra=await verifyRestore({evidencePath:a.evidence,archivePath:a.archivePath,restoreDir:path.join(a.dir,'restore'),outputPath:path.join(a.dir,'out.json')}); const rb=await verifyRestore({evidencePath:b.evidence,archivePath:b.archivePath,restoreDir:path.join(b.dir,'restore'),outputPath:path.join(b.dir,'out.json')}); assert.equal(ra.identity,rb.identity); assert.equal((await readFile(path.join(a.dir,'restore/runtime/index.html'))).toString().startsWith('<html'),true); } finally { await rm(a.dir,{recursive:true,force:true}); await rm(b.dir,{recursive:true,force:true}); }});

test('rejects duplicate archive paths', async()=>{ const f=await fixture([{path:'runtime/index.html',data:'a',mode:0o644},{path:'runtime/index.html',data:'a',mode:0o644}]); try { await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:path.join(f.dir,'r'),outputPath:path.join(f.dir,'o')}),/duplicate archive path/); } finally { await rm(f.dir,{recursive:true,force:true}); }});

test('rejects traversal paths', async()=>{ const f=await fixture([{path:'../escape',data:'x',mode:0o644}]); try { await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:path.join(f.dir,'r'),outputPath:path.join(f.dir,'o')}),/unsafe path/); } finally { await rm(f.dir,{recursive:true,force:true}); }});

test('rejects truncated archives', async()=>{ const f=await fixture(); try { const cut=f.arc.subarray(0,f.arc.length-512); await writeFile(f.archivePath,cut); f.ev.archive={sha256:sha(cut),size:cut.length}; f.ev.identity=identity(f.ev); await writeFile(f.evidence,JSON.stringify(f.ev)); await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:path.join(f.dir,'r'),outputPath:path.join(f.dir,'o')}),/terminal zero blocks/); } finally { await rm(f.dir,{recursive:true,force:true}); }});

test('rejects undeclared archive material', async()=>{ const f=await fixture(); try { f.ev.manifest.entries=f.ev.manifest.entries.slice(0,1); f.ev.identity=identity(f.ev); await writeFile(f.evidence,JSON.stringify(f.ev)); await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:path.join(f.dir,'r'),outputPath:path.join(f.dir,'o')}),/undeclared entries/); } finally { await rm(f.dir,{recursive:true,force:true}); }});

test('rejects stale bundle identity', async()=>{ const f=await fixture(); try { f.ev.releaseIdentity='tampered'; await writeFile(f.evidence,JSON.stringify(f.ev)); await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:path.join(f.dir,'r'),outputPath:path.join(f.dir,'o')}),/stale deployment bundle identity/); } finally { await rm(f.dir,{recursive:true,force:true}); }});

test('refuses existing restore directory and evidence replacement', async()=>{ const f=await fixture(); try { const restore=path.join(f.dir,'restore'), out=path.join(f.dir,'out'); await verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:restore,outputPath:out}); const before=await readFile(out); await assert.rejects(()=>verifyRestore({evidencePath:f.evidence,archivePath:f.archivePath,restoreDir:restore,outputPath:out}),/restore directory already exists/); assert.deepEqual(await readFile(out),before); } finally { await rm(f.dir,{recursive:true,force:true}); }});
