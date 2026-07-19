import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { supervise } from './supervise-owned-listener.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const html = Buffer.from('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><body>ok</body></html>');

async function fixture(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-supervisor-'));
  const server = path.join(dir, 'server.mjs');
  const body = options.body ?? html;
  await writeFile(server, `import http from 'node:http';\nconst body=Buffer.from(${JSON.stringify(body.toString())});\nconst digest=${JSON.stringify(sha(body))};\nconst server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html','x-fia-content-sha256':${JSON.stringify(options.headerDigest ?? sha(body))},'x-fia-schema':${JSON.stringify(options.schema ?? 'fia.owned-static-runtime-server.v1')}});res.end(body)});\nserver.listen(0,'127.0.0.1',()=>{const a=server.address();console.log(JSON.stringify({schema:${JSON.stringify(options.startupSchema ?? 'fia.owned-static-runtime-server.v1')},host:'127.0.0.1',port:a.port,runtime:'/fixture'}))});\nprocess.on('SIGTERM',()=>server.close(()=>process.exit(0)));\n`);
  const request = path.join(dir, 'request.json');
  await writeFile(request, JSON.stringify({ schema:'fia.owned-listener-supervision-request.v1', releaseIdentity:'a'.repeat(64), command:[process.execPath,server], cwd:dir, probe:{path:'/',contentSha256:sha(html),schema:'fia.owned-static-runtime-server.v1'}, startupTimeoutMs:3000, probeTimeoutMs:3000, shutdownTimeoutMs:1000 }));
  return { dir, request, output:path.join(dir,'evidence.json') };
}

test('starts, probes, identifies, and terminates an owned listener', async () => {
  const f = await fixture();
  try {
    const { evidence, child } = await supervise({ requestPath:f.request, outputPath:f.output, stopAfterProbe:true });
    assert.equal(evidence.schema,'fia.owned-listener-supervision.v1');
    assert.equal(evidence.probe.contentSha256,sha(html));
    assert.match(evidence.process.listenerId,/^[a-f0-9]{64}$/);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally { await rm(f.dir,{recursive:true,force:true}); }
});

test('rejects served-byte mismatch and kills candidate', async () => {
  const f = await fixture({ body:Buffer.from('wrong') });
  try { await assert.rejects(supervise({requestPath:f.request,outputPath:f.output,stopAfterProbe:true}),/served content digest mismatch/); }
  finally { await rm(f.dir,{recursive:true,force:true}); }
});

test('rejects dishonest digest header', async () => {
  const f = await fixture({ headerDigest:'0'.repeat(64) });
  try { await assert.rejects(supervise({requestPath:f.request,outputPath:f.output,stopAfterProbe:true}),/served digest header mismatch/); }
  finally { await rm(f.dir,{recursive:true,force:true}); }
});

test('rejects substituted startup schema', async () => {
  const f = await fixture({ startupSchema:'other.server.v1' });
  try { await assert.rejects(supervise({requestPath:f.request,outputPath:f.output,stopAfterProbe:true}),/startup schema/); }
  finally { await rm(f.dir,{recursive:true,force:true}); }
});

test('requires an absolute executable', async () => {
  const f = await fixture();
  try {
    const request=JSON.parse(await readFile(f.request)); request.command[0]='node'; await writeFile(f.request,JSON.stringify(request));
    await assert.rejects(supervise({requestPath:f.request,outputPath:f.output,stopAfterProbe:true}),/executable must be absolute/);
  } finally { await rm(f.dir,{recursive:true,force:true}); }
});

test('refuses to overwrite retained evidence', async () => {
  const f = await fixture();
  try {
    await writeFile(f.output,'retained');
    await assert.rejects(supervise({requestPath:f.request,outputPath:f.output,stopAfterProbe:true}),/refusing to overwrite/);
    assert.equal(await readFile(f.output,'utf8'),'retained');
  } finally { await rm(f.dir,{recursive:true,force:true}); }
});
