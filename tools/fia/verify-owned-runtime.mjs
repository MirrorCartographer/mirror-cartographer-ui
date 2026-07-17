#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const MIME = new Map([
  ['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],['.js','text/javascript; charset=utf-8'],
  ['.mjs','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],
  ['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.ico','image/x-icon'],
  ['.woff','font/woff'],['.woff2','font/woff2'],['.txt','text/plain; charset=utf-8'],['.xml','application/xml; charset=utf-8']
]);
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/;
const CACHE_IMMUTABLE = /(?:^|[._-])[a-f0-9]{8,}(?:[._-]|$)/i;
const sha = data => `sha256:${createHash('sha256').update(data).digest('hex')}`;

function args(argv) {
  const out = { historyFallback: false };
  for (let i=2;i<argv.length;i++) {
    const k=argv[i];
    if (k === '--historyFallback') out.historyFallback = true;
    else if (k.startsWith('--')) out[k.slice(2)] = argv[++i];
  }
  if (!out.artifact || !out.output) throw new Error('required: --artifact <dir> --output <file>');
  return out;
}
function safePath(root, pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(root, clean || 'index.html');
  if (candidate !== root && !candidate.startsWith(root + sep)) throw new Error('path traversal');
  return candidate;
}
async function fileExists(path) { try { return (await fs.stat(path)).isFile(); } catch { return false; } }
async function resolveRequest(root, pathname, historyFallback) {
  let path = safePath(root, pathname);
  if (await fileExists(path)) return path;
  if (await fileExists(join(path, 'index.html'))) return join(path, 'index.html');
  if (historyFallback && await fileExists(join(root, 'index.html'))) return join(root, 'index.html');
  return null;
}
async function inventory(root) {
  const files=[];
  async function walk(dir) {
    const entries=(await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for (const e of entries) {
      const p=join(dir,e.name); const rel=relative(root,p).split(sep).join('/');
      if (e.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) { const b=await fs.readFile(p); const st=await fs.stat(p); files.push({path:rel,bytes:b.length,mode:st.mode & 0o777,sha256:sha(b)}); }
      else throw new Error(`unsupported entry: ${rel}`);
    }
  }
  await walk(root); return files;
}
function routes(files) {
  return files.filter(f=>f.path.endsWith('.html')).map(f=>({
    route:f.path==='index.html'?'/':f.path.endsWith('/index.html')?`/${f.path.slice(0,-10)}`:`/${f.path}`,
    file:f.path
  })).sort((a,b)=>a.route.localeCompare(b.route));
}
async function startOwnedServer(root, historyFallback=false) {
  const server=createServer(async (req,res)=>{
    try {
      const file=await resolveRequest(root, req.url || '/', historyFallback);
      if (!file) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}); return res.end('Not Found'); }
      const data=await fs.readFile(file); const type=MIME.get(extname(file).toLowerCase()) || 'application/octet-stream';
      const etag=`"${createHash('sha256').update(data).digest('hex')}"`;
      const rel=relative(root,file).split(sep).join('/');
      const headers={'content-type':type,'etag':etag,'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
      headers['cache-control']=CACHE_IMMUTABLE.test(rel)?'public, max-age=31536000, immutable':type.startsWith('text/html')?'no-cache':'public, max-age=3600';
      if (req.headers['if-none-match']===etag) { res.writeHead(304,headers); return res.end(); }
      const gzip=String(req.headers['accept-encoding']||'').includes('gzip') && COMPRESSIBLE.test(type) && data.length>128;
      if (gzip) headers['content-encoding']='gzip';
      res.writeHead(200,headers);
      if (req.method==='HEAD') return res.end();
      if (gzip) await pipeline(createReadStream(file),createGzip({mtime:0}),res); else res.end(data);
    } catch (error) { res.writeHead(400,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}); res.end(String(error.message||error)); }
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
  const {port}=server.address(); return {server,base:`http://127.0.0.1:${port}`};
}
async function probe(base, route, expectedType) {
  const response=await fetch(base+route,{headers:{'accept-encoding':'gzip'}});
  const body=Buffer.from(await response.arrayBuffer());
  const headers=Object.fromEntries([...response.headers.entries()].sort(([a],[b])=>a.localeCompare(b)));
  const failures=[];
  if (response.status!==200) failures.push(`status:${response.status}`);
  if (!String(headers['content-type']||'').startsWith(expectedType.split(';')[0])) failures.push(`mime:${headers['content-type']||'missing'}`);
  if (!headers.etag) failures.push('etag:missing');
  if (!headers['cache-control']) failures.push('cache-control:missing');
  for (const h of ['server','x-vercel-id','cf-ray','x-powered-by']) if (headers[h]) failures.push(`provider-header:${h}`);
  const head=await fetch(base+route,{method:'HEAD'}); if (head.status!==200) failures.push(`head-status:${head.status}`);
  const conditional=await fetch(base+route,{headers:{'if-none-match':headers.etag||''}}); if (conditional.status!==304) failures.push(`etag-revalidation:${conditional.status}`);
  return {route,status:response.status,headers,decodedBytes:body.length,failures};
}
async function verifyArtifact(root, historyFallback) {
  const files=await inventory(root); const graph=routes(files); if (!graph.length) throw new Error('artifact has no HTML routes');
  const {server,base}=await startOwnedServer(root,historyFallback);
  try {
    const probes=[];
    for (const r of graph) probes.push(await probe(base,r.route,'text/html; charset=utf-8'));
    for (const f of files.filter(x=>!x.path.endsWith('.html')).slice(0,12)) probes.push(await probe(base,`/${f.path}`,MIME.get(extname(f.path).toLowerCase())||'application/octet-stream'));
    const missing=await fetch(base+'/__fia_missing_route__');
    if (!historyFallback && missing.status!==404) throw new Error(`missing route returned ${missing.status}`);
    if (historyFallback && missing.status!==200) throw new Error(`history fallback returned ${missing.status}`);
    const failures=probes.flatMap(p=>p.failures.map(f=>({route:p.route,failure:f})));
    if (failures.length) throw new Error(`runtime verification failed: ${JSON.stringify(failures)}`);
    const artifact=sha(Buffer.from(JSON.stringify(files)));
    return {artifact,files,routes:graph,probes:probes.map(p=>({route:p.route,status:p.status,contentType:p.headers['content-type'],cacheControl:p.headers['cache-control'],etag:p.headers.etag,contentEncoding:p.headers['content-encoding']||null,decodedBytes:p.decodedBytes}))};
  } finally { await new Promise(ok=>server.close(ok)); }
}

export async function main(argv=process.argv) {
  const a=args(argv); const root=resolve(a.artifact); const output=resolve(a.output);
  const primary=await verifyArtifact(root,a.historyFallback);
  let rollback=null;
  if (a.rollbackArtifact) rollback=await verifyArtifact(resolve(a.rollbackArtifact),a.historyFallback);
  const evidence={schema:'fia.owned-runtime-verification.v1',status:'accepted',policy:{historyFallback:a.historyFallback,network:'loopback-only',providerHeadersForbidden:true,etagRequired:true,cacheControlRequired:true,headRequired:true,rollbackRequired:Boolean(a.rollbackArtifact)},primary,rollback};
  evidence.verification=sha(Buffer.from(JSON.stringify(evidence)));
  await fs.mkdir(resolve(output,'..'),{recursive:true});
  await fs.writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  process.stdout.write(`${evidence.verification}\n`);
}
if (import.meta.url===`file://${process.argv[1]}`) main().catch(e=>{console.error(e.message);process.exitCode=1});
