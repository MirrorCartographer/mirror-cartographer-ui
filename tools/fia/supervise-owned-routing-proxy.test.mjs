import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const subject = path.join(path.dirname(fileURLToPath(import.meta.url)), 'supervise-owned-routing-proxy.mjs');
const hash = value => createHash('sha256').update(value).digest('hex');

async function fixture({ badRoute = false, crash = false } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fia-proxy-supervision-'));
  const proxy = path.join(dir, 'proxy.mjs');
  const route = hash('route');
  const release = hash('release');
  await writeFile(proxy, `#!/usr/bin/env node\nimport http from 'node:http';\nconst host='127.0.0.1',port=Number(process.argv[2]);\n${crash ? "process.exit(3);" : ''}\nconst proxyIdentity='${hash('proxy')}';\nconst server=http.createServer((request,response)=>{response.setHeader('X-FIA-Route-Identity','${badRoute ? hash('wrong') : route}');response.setHeader('X-FIA-Proxy-Identity',proxyIdentity);response.end('ok')});\nserver.listen(port,host,()=>console.log(JSON.stringify({schema:'fia.owned-routing-proxy-state.v1',host,port,proxyIdentity})));\nprocess.on('SIGTERM',()=>server.close(()=>process.exit(0)));\n`);
  await chmod(proxy, 0o755);
  const port = 45000 + Math.floor(Math.random() * 10000);
  const request = { schema:'fia.owned-routing-proxy-supervision-request.v1', command:proxy, args:[String(port)], host:'127.0.0.1', port, probePath:'/', timeoutMs:1000, restartLimit: crash || badRoute ? 1 : 0, releaseIdentity:release, routeIdentity:route };
  const requestPath = path.join(dir,'request.json');
  const output = path.join(dir,'evidence.json');
  await writeFile(requestPath, JSON.stringify(request));
  return { requestPath, output, request };
}

function run(requestPath, output) {
  return new Promise(resolve => {
    const child = spawn(process.execPath,[subject,'--request',requestPath,'--output',output]);
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('exit', code => resolve({ code, stdout, stderr }));
  });
}

test('supervises real proxy and emits process-bound evidence', async () => {
  const value = await fixture();
  const result = await run(value.requestPath,value.output);
  assert.equal(result.code,0,result.stderr);
  const evidence = JSON.parse(await readFile(value.output));
  assert.equal(evidence.schema,'fia.owned-routing-proxy-supervision.v1');
  assert.equal(evidence.routeIdentity,value.request.routeIdentity);
  assert.equal(evidence.attempts.length,1);
  assert.equal(evidence.attempts[0].accepted,true);
  process.kill(-evidence.activeProcess.pid,'SIGTERM');
});

test('rejects wrong route identity and exhausts bounded restarts', async () => {
  const value = await fixture({badRoute:true});
  const result = await run(value.requestPath,value.output);
  assert.notEqual(result.code,0);
  assert.match(result.stderr,/exhausted restart policy/);
});

test('rejects crashing proxy startup', async () => {
  const value = await fixture({crash:true});
  const result = await run(value.requestPath,value.output);
  assert.notEqual(result.code,0);
  assert.match(result.stderr,/exited during startup|startup timeout/);
});

test('requires absolute executable authority', async () => {
  const value = await fixture();
  value.request.command='node';
  await writeFile(value.requestPath,JSON.stringify(value.request));
  const result = await run(value.requestPath,value.output);
  assert.notEqual(result.code,0);
  assert.match(result.stderr,/absolute/);
});

test('rejects non-loopback binding', async () => {
  const value = await fixture();
  value.request.host='0.0.0.0';
  await writeFile(value.requestPath,JSON.stringify(value.request));
  const result = await run(value.requestPath,value.output);
  assert.notEqual(result.code,0);
  assert.match(result.stderr,/loopback/);
});

test('refuses to overwrite retained evidence before launch', async () => {
  const value = await fixture();
  await writeFile(value.output,'sentinel');
  const result = await run(value.requestPath,value.output);
  assert.notEqual(result.code,0);
  assert.equal(await readFile(value.output,'utf8'),'sentinel');
});
