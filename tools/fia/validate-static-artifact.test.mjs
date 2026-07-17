import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateStaticArtifact } from './validate-static-artifact.mjs';

const good=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mirror</title><link rel="stylesheet" href="assets/app.css"></head><body><main><h1>Mirror</h1><img src="assets/logo.svg" alt="Mirror Cartographer"><a href="about/">About</a><button aria-label="Open map"></button></main></body></html>`;
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'fia-static-'));await mkdir(path.join(root,'assets'),{recursive:true});await mkdir(path.join(root,'about'),{recursive:true});await writeFile(path.join(root,'index.html'),good);await writeFile(path.join(root,'about/index.html'),good.replace('href="assets/app.css"','href="../assets/app.css"').replace('src="assets/logo.svg"','src="../assets/logo.svg"').replace('href="about/"','href="/"'));await writeFile(path.join(root,'assets/app.css'),'body{max-width:100%;}');await writeFile(path.join(root,'assets/logo.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');return root;}
async function run(root,name='validation.json'){return validateStaticArtifact({artifact:root,output:path.join(root,'..',`${path.basename(root)}-${name}`)});}

test('valid provider-neutral offline artifact produces stable evidence',async()=>{const a=await fixture(),b=await fixture();const one=await run(a),two=await run(b);assert.equal(one.validation,two.validation);assert.equal(one.status,'accepted');assert.deepEqual(one.routes.map(r=>r.route),['/','/about/']);});
test('broken local references are rejected with retained evidence',async()=>{const root=await fixture();await writeFile(path.join(root,'index.html'),good.replace('assets/logo.svg','assets/missing.svg'));const output=path.join(root,'..',`${path.basename(root)}-failed.json`);await assert.rejects(validateStaticArtifact({artifact:root,output}),/rejected/);const record=JSON.parse(await readFile(output));assert(record.issues.some(i=>i.code==='broken-local-reference'));});
test('autoplay and inaccessible controls are rejected',async()=>{const root=await fixture();await writeFile(path.join(root,'index.html'),good.replace('<button aria-label="Open map"></button>','<button></button><video autoplay></video>'));await assert.rejects(run(root),/rejected/);});
test('external references and provider coupling are rejected',async()=>{const root=await fixture();await writeFile(path.join(root,'index.html'),good.replace('</main>','<script src="https://example.com/app.js"></script><p>vercel.app</p></main>'));await assert.rejects(run(root),/rejected/);});
test('unsafe mobile viewport is rejected',async()=>{const root=await fixture();await writeFile(path.join(root,'index.html'),good.replace('width=device-width, initial-scale=1','width=device-width, maximum-scale=1, user-scalable=no'));await assert.rejects(run(root),/rejected/);});
test('retained validation evidence cannot be overwritten',async()=>{const root=await fixture(),output=path.join(root,'..',`${path.basename(root)}-same.json`);await validateStaticArtifact({artifact:root,output});await assert.rejects(validateStaticArtifact({artifact:root,output}),/EEXIST/);});
