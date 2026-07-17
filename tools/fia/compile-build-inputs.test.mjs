import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileBuildInputs } from './compile-build-inputs.mjs';

async function fixture(plan){const root=await mkdtemp(path.join(os.tmpdir(),'fia-inputs-'));await mkdir(path.join(root,'src'),{recursive:true});await mkdir(path.join(root,'tools'),{recursive:true});await writeFile(path.join(root,'src','app.js'),'app');await writeFile(path.join(root,'src','debug.tmp'),'ignore');await writeFile(path.join(root,'tools','build.mjs'),'build');await writeFile(path.join(root,'package.json'),'{}');await writeFile(path.join(root,'inputs.json'),JSON.stringify(plan));return root;}
async function run(root,name='manifest.json'){return compileBuildInputs({source:root,plan:path.join(root,'inputs.json'),output:path.join(root,name)});}

test('canonical manifest excludes parent-directory overreach and binds local executable',async()=>{const plan={schema:'fia.build-input-plan.v1',inputs:['src','tools/build.mjs','package.json'],excludes:['src/**/*.tmp'],command:'node tools/build.mjs'};const a=await fixture(plan),b=await fixture(plan);try{const x=await run(a),y=await run(b);assert.equal(x.manifest,y.manifest);assert.deepEqual(x.excluded,['src/debug.tmp']);assert(!x.files.some(f=>f.path.endsWith('.tmp')));assert.deepEqual(x.executables,['tools/build.mjs']);}finally{await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true});}});
test('overlapping declarations are rejected',async()=>{const root=await fixture({schema:'fia.build-input-plan.v1',inputs:['src','src/app.js']});try{await assert.rejects(run(root),/overlapping declared inputs/);}finally{await rm(root,{recursive:true,force:true});}});
test('undeclared local executable is rejected',async()=>{const root=await fixture({schema:'fia.build-input-plan.v1',inputs:['src','package.json'],command:'node tools/build.mjs'});try{await assert.rejects(run(root),/undeclared local executable/);}finally{await rm(root,{recursive:true,force:true});}});
test('symlink input is rejected',async()=>{const root=await fixture({schema:'fia.build-input-plan.v1',inputs:['linked']});try{await symlink(path.join(root,'src'),path.join(root,'linked'));await assert.rejects(run(root),/symbolic link rejected/);}finally{await rm(root,{recursive:true,force:true});}});
test('unmatched exclusions fail closed',async()=>{const root=await fixture({schema:'fia.build-input-plan.v1',inputs:['src'],excludes:['src/**/*.map']});try{await assert.rejects(run(root),/exclusion matched no input/);}finally{await rm(root,{recursive:true,force:true});}});
test('retained manifest cannot be overwritten',async()=>{const root=await fixture({schema:'fia.build-input-plan.v1',inputs:['src']});try{await run(root);await assert.rejects(run(root),/EEXIST/);assert.match(await readFile(path.join(root,'manifest.json'),'utf8'),/fia.build-input-manifest.v1/);}finally{await rm(root,{recursive:true,force:true});}});
