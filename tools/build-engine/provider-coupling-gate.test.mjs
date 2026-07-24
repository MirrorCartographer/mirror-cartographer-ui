#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {scan} from "./provider-coupling-gate.mjs";
function fixture(files){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"fia-provider-gate-"));for(const [name,body] of Object.entries(files)){const full=path.join(dir,name);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,body);}return dir;}
test("clean source passes",()=>{const d=fixture({"package.json":JSON.stringify({scripts:{build:"vite build"}})});assert.equal(scan(d).summary.blocking,0);});
test("provider command fails closed",()=>{const d=fixture({"package.json":JSON.stringify({scripts:{deploy:"npx vercel"}})});const r=scan(d);assert.equal(r.summary.blocking,1);assert.equal(r.hits[0].provider,"vercel");});
test("migration-only exception remains visible",()=>{const d=fixture({"migration/vercel-export.md":"vercel export procedure"});const r=scan(d,{allowed:[{provider:"vercel",path_prefix:"migration/",scope:"migration-only"}]});assert.equal(r.summary.blocking,0);assert.equal(r.summary.migration_only,1);});
test("github pages base path is detected",()=>{const d=fixture({"package.json":JSON.stringify({scripts:{"build:pages":"vite build"}})});assert.equal(scan(d).hits.some(h=>h.provider==="github-pages"),true);});
test("symlink is rejected",()=>{const d=fixture({"a.js":"ok"});try{fs.symlinkSync(path.join(d,"a.js"),path.join(d,"link.js"));}catch{return;}assert.throws(()=>scan(d),/symlink rejected/);});
