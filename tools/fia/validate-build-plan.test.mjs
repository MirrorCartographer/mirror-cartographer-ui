import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectCommand, validateBuildPlan } from './validate-build-plan.mjs';
const tmp=()=>mkdtemp(path.join(os.tmpdir(),'fia-plan-preflight-'));
async function plan(dir,steps){const file=path.join(dir,'plan.json');await writeFile(file,JSON.stringify({schema:'fia.build-plan.v1',steps}));return file;}

test('accepts provider-neutral immutable build commands with stable evidence',async()=>{const dir=await tmp();const file=await plan(dir,[{name:'deps',command:'npm ci --ignore-scripts'},{name:'compile',command:'npm run build'}]);const a=await validateBuildPlan({plan:file});const b=await validateBuildPlan({plan:file});assert.equal(a.preflight,b.preflight);assert.equal(a.status,'accepted');assert.equal(a.steps.length,2);});
test('rejects hosted provider coupling before execution',()=>{for(const command of ['vercel deploy','wrangler pages deploy dist','npm run deploy:cloudflare','gh-pages -d dist'])assert.ok(inspectCommand(command).some(x=>x.code==='provider-coupling'));});
test('rejects network and publication commands',()=>{for(const command of ['curl https://example.invalid/x','git push origin preview','docker push registry/image','kubectl apply -f release.yaml'])assert.ok(inspectCommand(command).some(x=>['network-command','publication-command'].includes(x.code)));});
test('rejects mutable package installation and package executors',()=>{for(const command of ['npm install','npm i vite','pnpm add react','pnpm install','yarn install','npx vite build'])assert.ok(inspectCommand(command).some(x=>['mutable-dependency-command','mutable-package-executor'].includes(x.code)));assert.equal(inspectCommand('pnpm install --frozen-lockfile --offline').length,0);assert.equal(inspectCommand('yarn install --immutable --offline').length,0);});
test('rejects dynamic shell expansion',()=>{for(const command of ['echo $(cat token)','echo `hostname`','echo ${!secret}'])assert.ok(inspectCommand(command).some(x=>x.code==='dynamic-shell-expansion'));});
test('retains accepted evidence immutably',async()=>{const dir=await tmp();const file=await plan(dir,[{name:'compile',command:'node tools/build.mjs'}]);const output=path.join(dir,'preflight.json');await validateBuildPlan({plan:file,output});const saved=JSON.parse(await readFile(output));assert.equal(saved.schema,'fia.build-plan-preflight.v1');await assert.rejects(validateBuildPlan({plan:file,output}));});
