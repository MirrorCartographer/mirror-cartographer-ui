#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`:JSON.stringify(value);
const sha=data=>`sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const key of ['HOME','USER','LOGNAME','TMPDIR','SSH_AUTH_SOCK','AWS_ACCESS_KEY_ID','GITHUB_TOKEN'])if(key in(spec.environment??{}))throw new Error(`forbidden environment input: ${key}`);
if(spec.network!=='none')throw new Error('canonical action must disable network');
if(!/^sha256:[0-9a-f]{64}$/.test(spec.toolchain_digest??''))throw new Error('toolchain digest required');
if(!/^sha256:[0-9a-f]{64}$/.test(spec.platform_digest??''))throw new Error('platform digest required');
if(!Array.isArray(spec.inputs)||!spec.inputs.every(x=>/^sha256:[0-9a-f]{64}$/.test(x.digest)))throw new Error('content-addressed inputs required');
if(!Array.isArray(spec.outputs)||spec.outputs.length===0)throw new Error('declared outputs required');
const canonical=stable(spec);process.stdout.write(JSON.stringify({schema:'foundation.build.action-key.v1',action_digest:sha(canonical),canonical},null,2)+'\n');
