#!/usr/bin/env node
import fs from "node:fs"; import crypto from "node:crypto";
const [catalogPath,outPath]=process.argv.slice(2); if(!catalogPath||!outPath) process.exit(2);
const catalog=JSON.parse(fs.readFileSync(catalogPath,"utf8"));
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const digest=x=>"sha256:"+crypto.createHash("sha256").update(JSON.stringify(stable(x))).digest("hex");
const ids=new Set(); for(const t of catalog.tests){if(ids.has(t.id))throw new Error(`duplicate test id ${t.id}`);ids.add(t.id)}
const shards=Array.from({length:catalog.shards},(_,index)=>({index,tests:[]}));
for(const t of [...catalog.tests].sort((a,b)=>a.id.localeCompare(b.id))){const n=parseInt(crypto.createHash("sha256").update(t.id).digest("hex").slice(0,8),16)%catalog.shards;shards[n].tests.push(t.id)}
const plan={schema:"foundation.test.plan.v1",catalog_digest:digest(catalog),seed:catalog.seed,shards:shards.map(s=>({...s,digest:digest(s.tests)}))};
plan.plan_digest=digest(plan); fs.writeFileSync(outPath,JSON.stringify(stable(plan),null,2)+"\n"); console.log(plan.plan_digest);
