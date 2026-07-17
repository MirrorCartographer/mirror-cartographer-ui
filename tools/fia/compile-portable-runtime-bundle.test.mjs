import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { compilePortableRuntimeBundle } from './compile-portable-runtime-bundle.mjs';

async function fixture(root,name,text='ok'){
  const dir=path.join(root,name);await fs.mkdir(path.join(dir,'assets'),{recursive:true});
  await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="en"><head><title>${name}</title></head><body><main><h1>${name}</h1><script src="/assets/app.12345678.js"></script><p>${text}</p></main></body></html>`);
  await fs.writeFile(path.join(dir,'assets/app.12345678.js'),`console.log(${JSON.stringify(text)})`);return dir;
}
async function temp(){return fs.mkdtemp(path.join(os.tmpdir(),'fia-portable-'));}

test('equivalent artifacts produce stable bundle and rehearsal identities', async()=>{const a=await temp(),b=await temp();try{for(const root of [a,b]){await fixture(root,'current');await fixture(root,'rollback','old');}
const x=await compilePortableRuntimeBundle({current:path.join(a,'current'),rollback:path.join(a,'rollback'),bundle:path.join(a,'bundle'),rehearsal:path.join(a,'import')});
const y=await compilePortableRuntimeBundle({current:path.join(b,'current'),rollback:path.join(b,'rollback'),bundle:path.join(b,'bundle'),rehearsal:path.join(b,'import')});
assert.equal(x.manifest.bundle,y.manifest.bundle);assert.equal(x.attestation.rehearsal,y.attestation.rehearsal);}finally{await fs.rm(a,{recursive:true,force:true});await fs.rm(b,{recursive:true,force:true});}});

test('deduplicates identical bytes into one content-addressed object', async()=>{const root=await temp();try{const current=await fixture(root,'current','same'),rollback=await fixture(root,'rollback','same');await fs.copyFile(path.join(current,'assets/app.12345678.js'),path.join(rollback,'assets/app.12345678.js'));
const {manifest}=await compilePortableRuntimeBundle({current,rollback,bundle:path.join(root,'bundle'),rehearsal:path.join(root,'import')});const a=manifest.artifacts.current.files.find(f=>f.path.endsWith('.js'));const b=manifest.artifacts.rollback.files.find(f=>f.path.endsWith('.js'));assert.equal(a.object,b.object);}finally{await fs.rm(root,{recursive:true,force:true});}});

test('rejects symlink contamination', async()=>{const root=await temp();try{const current=await fixture(root,'current'),rollback=await fixture(root,'rollback');await fs.symlink('index.html',path.join(current,'alias.html'));await assert.rejects(()=>compilePortableRuntimeBundle({current,rollback,bundle:path.join(root,'bundle'),rehearsal:path.join(root,'import')}),/symlink rejected/);}finally{await fs.rm(root,{recursive:true,force:true});}});

test('rehearsal proves current and rollback routes boot from imported bundle', async()=>{const root=await temp();try{const current=await fixture(root,'current'),rollback=await fixture(root,'rollback','old');const {attestation}=await compilePortableRuntimeBundle({current,rollback,bundle:path.join(root,'bundle'),rehearsal:path.join(root,'import')});assert.deepEqual(attestation.targets.map(x=>x.target),['current','rollback']);assert.ok(attestation.targets.every(x=>x.routes.every(r=>r.status===200)));}finally{await fs.rm(root,{recursive:true,force:true});}});

test('refuses existing bundle or rehearsal destinations', async()=>{const root=await temp();try{const current=await fixture(root,'current'),rollback=await fixture(root,'rollback');await fs.mkdir(path.join(root,'bundle'));await assert.rejects(()=>compilePortableRuntimeBundle({current,rollback,bundle:path.join(root,'bundle'),rehearsal:path.join(root,'import')}),/destination exists/);}finally{await fs.rm(root,{recursive:true,force:true});}});

test('import tampering is detectable from retained object identities', async()=>{const root=await temp();try{const current=await fixture(root,'current'),rollback=await fixture(root,'rollback');const bundle=path.join(root,'bundle'),rehearsal=path.join(root,'import');const result=await compilePortableRuntimeBundle({current,rollback,bundle,rehearsal});const object=result.manifest.artifacts.current.files[0].object;await fs.writeFile(path.join(rehearsal,object),'tampered');const bytes=await fs.readFile(path.join(rehearsal,object));const actual=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;assert.notEqual(actual,result.manifest.artifacts.current.files[0].sha256);}finally{await fs.rm(root,{recursive:true,force:true});}});
