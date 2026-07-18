#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const[inputDir,outputFile,epochText]=process.argv.slice(2),epoch=Number(epochText);if(!inputDir||!outputFile||!Number.isInteger(epoch)||epoch<315532800)throw new Error('usage: deterministic-archive.mjs INPUT OUTPUT EPOCH');
const entries=[];for(const name of fs.readdirSync(inputDir).sort()){const abs=path.join(inputDir,name),st=fs.lstatSync(abs);if(st.isSymbolicLink()||!st.isFile())throw new Error(`unsupported entry: ${name}`);entries.push({path:name,mode:(st.mode&0o111)?'0755':'0644',data:fs.readFileSync(abs).toString('base64')});}
const payload=JSON.stringify({schema:'foundation.build.archive.v1',source_date_epoch:epoch,entries});fs.writeFileSync(outputFile,payload);process.stdout.write(`sha256:${crypto.createHash('sha256').update(payload).digest('hex')}\n`);
